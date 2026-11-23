require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const storage = require('./services/storage.service');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const jobsRoutes = require('./routes/jobs.routes');
const applicationsRoutes = require('./routes/applications.routes');
const filesRoutes = require('./routes/files.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) {
  console.error('Configura JWT_SECRET con al menos 32 caracteres en backend/.env (ver .env.example).');
  process.exit(1);
}

const app = express();
// Detras del proxy de Render/Railway/Nginx: necesario para cookies Secure y el rate limit por IP.
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/health', healthRoutes);
app.get('/docs.json', (_req, res) => res.json(openapi));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'NOVA API', swaggerOptions: { withCredentials: true } }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/files', filesRoutes);

// El mismo servidor entrega el frontend: en produccion basta con desplegar un solo servicio.
if (process.env.SERVE_FRONTEND !== 'false') {
  app.use(express.static(path.resolve(__dirname, '..', '..', 'frontend'), { extensions: ['html'] }));
}

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`NOVA escuchando en http://localhost:${port}  (docs: /docs)`);
  console.log(`Almacenamiento de archivos: ${storage.driver === 'supabase' ? `Supabase Storage, bucket "${storage.bucket}"` : 'disco local (backend/uploads)'}`);
});

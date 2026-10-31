require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const jobsRoutes = require('./routes/jobs.routes');

const app = express();
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
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`NOVA backend escuchando en http://localhost:${port}`));
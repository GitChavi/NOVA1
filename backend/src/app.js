require('dotenv').config();

const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());
app.use('/health', healthRoutes);

app.get('/', (_req, res) => {
  res.json({ app: 'NOVA', status: 'running' });
});

app.listen(port, () => {
  console.log(`NOVA backend escuchando en http://localhost:${port}`);
});
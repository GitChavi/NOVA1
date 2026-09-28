const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
const validPassword = (value) => typeof value === 'string' && value.length >= 6 && /[A-Z]/.test(value) && /[0-9]/.test(value);

router.post('/register', async (req, res) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  const tipo = req.body.tipo;

  if (nombre.length < 2 || nombre.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ingresa un nombre y correo válidos.' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'La contraseña requiere 6 caracteres, una mayúscula y un número.' });
  }
  if (!['candidato', 'empresa'].includes(tipo)) {
    return res.status(400).json({ error: 'Selecciona candidato o empresa.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash, tipo) VALUES ($1, $2, $3, $4) RETURNING id',
      [nombre, email, passwordHash, tipo]
    );
    const userId = created.rows[0].id;
    if (tipo === 'candidato') {
      await client.query('INSERT INTO perfiles_candidato (usuario_id) VALUES ($1)', [userId]);
    } else {
      await client.query(
        'INSERT INTO perfiles_empresa (usuario_id, nombre_empresa) VALUES ($1, $2)',
        [userId, nombre]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ message: 'Cuenta creada. Ya puedes iniciar sesión.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'Ese correo ya tiene una cuenta.' });
    console.error('Register error:', error.message);
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' });
  } finally {
    client?.release();
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, password_hash, tipo FROM usuarios WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no está configurado.');
      return res.status(500).json({ error: 'El servidor no tiene configurada la sesión.' });
    }
    const token = jwt.sign(
      { sub: user.id, nombre: user.nombre, email: user.email, tipo: user.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, tipo: user.tipo } });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.sub, nombre: req.user.nombre, email: req.user.email, tipo: req.user.tipo } });
});

module.exports = router;


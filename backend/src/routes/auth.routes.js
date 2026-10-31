const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
const cookieName = 'nova_session';
const sessionMs = 8 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMs,
  };
}

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(cookieName, token, cookieOptions());
}

function publicUser(row) {
  return { id: row.id, name: row.nombre, email: row.email, type: row.tipo };
}

function hasJwtSecret(res) {
  if (typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.length >= 32) return true;
  res.status(500).json({ error: 'Configura JWT_SECRET con al menos 32 caracteres en backend/.env.' });
  return false;
}

router.post('/register', async (req, res) => {
  if (!hasJwtSecret(res)) return;
  const { name, email, password, type } = req.body || {};
  const nombre = typeof name === 'string' ? name.trim() : '';
  const correo = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (nombre.length < 2 || nombre.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'Ingresa un nombre y un correo válidos.' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres, una mayúscula y un número.' });
  }
  if (!['candidato', 'empresa'].includes(type)) {
    return res.status(400).json({ error: 'Selecciona si la cuenta es de candidato o empresa.' });
  }

  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, tipo',
      [nombre, correo, passwordHash, type]
    );
    const user = result.rows[0];
    if (type === 'candidato') {
      await client.query('INSERT INTO perfiles_candidato (usuario_id) VALUES ($1)', [user.id]);
    } else {
      await client.query('INSERT INTO perfiles_empresa (usuario_id, nombre_empresa) VALUES ($1, $2)', [user.id, nombre]);
    }
    await client.query('COMMIT');
    setSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    console.error('Register error:', error.message);
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta nuevamente.' });
  } finally {
    client?.release();
  }
});

router.post('/login', async (req, res) => {
  if (!hasJwtSecret(res)) return;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!email || typeof password !== 'string') return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
  try {
    const result = await db.query(
      'SELECT id, nombre, email, tipo, password_hash FROM usuarios WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    setSession(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta nuevamente.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(cookieName, cookieOptions());
  return res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nombre, email, tipo FROM usuarios WHERE id = $1',
      [req.auth.sub]
    );
    if (!result.rows[0]) {
      res.clearCookie(cookieName, cookieOptions());
      return res.status(401).json({ error: 'La cuenta ya no existe. Inicia sesión nuevamente.' });
    }
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('Session lookup error:', error.message);
    return res.status(500).json({ error: 'No se pudo validar la sesión.' });
  }
});

module.exports = router;

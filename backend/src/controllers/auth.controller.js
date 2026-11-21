const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { cookieName, cookieOptions } = require('../config/session');
const { HttpError } = require('../utils/http-error');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, name: row.nombre, email: row.email, type: row.tipo };
}

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(cookieName, token, cookieOptions());
}

async function register(req, res) {
  const { name, email, password, type } = req.body || {};
  const nombre = typeof name === 'string' ? name.trim() : '';
  const correo = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (nombre.length < 2 || nombre.length > 120 || correo.length > 160 || !EMAIL_RE.test(correo)) {
    throw new HttpError(400, 'Ingresa un nombre y un correo válidos.');
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres, una mayúscula y un número.');
  }
  if (!['candidato', 'empresa'].includes(type)) {
    throw new HttpError(400, 'Selecciona si la cuenta es de candidato o empresa.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await db.transaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO usuarios (nombre, email, password_hash, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, tipo',
        [nombre, correo, passwordHash, type]
      );
      if (type === 'candidato') {
        await client.query('INSERT INTO perfiles_candidato (usuario_id) VALUES ($1)', [rows[0].id]);
      } else {
        await client.query('INSERT INTO perfiles_empresa (usuario_id, nombre_empresa) VALUES ($1, $2)', [rows[0].id, nombre]);
      }
      return rows[0];
    });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    throw error;
  }
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}

async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!email || typeof password !== 'string') throw new HttpError(400, 'Ingresa tu correo y contraseña.');

  const { rows } = await db.query('SELECT id, nombre, email, tipo, password_hash FROM usuarios WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}

function logout(_req, res) {
  res.clearCookie(cookieName, cookieOptions({ withMaxAge: false }));
  res.status(204).end();
}

async function me(req, res) {
  const { rows } = await db.query('SELECT id, nombre, email, tipo FROM usuarios WHERE id = $1', [req.auth.sub]);
  if (!rows[0]) {
    res.clearCookie(cookieName, cookieOptions({ withMaxAge: false }));
    throw new HttpError(401, 'La cuenta ya no existe. Inicia sesión nuevamente.');
  }
  res.json({ user: publicUser(rows[0]) });
}

module.exports = { register, login, logout, me, publicUser };

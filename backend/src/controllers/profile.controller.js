const db = require('../db');
const { publicFile } = require('../services/files.service');
const { HttpError } = require('../utils/http-error');

// Campos editables de cada perfil: nombre en la API -> [columna, longitud maxima].
const FIELDS = {
  candidato: { title: ['titulo_profesional', 160], location: ['ubicacion', 120], summary: ['resumen', 3000] },
  empresa: { company_name: ['nombre_empresa', 160], nit: ['nit', 60], sector: ['sector', 120], description: ['descripcion', 3000], website: ['sitio_web', 200] },
};
const TABLE = { candidato: 'perfiles_candidato', empresa: 'perfiles_empresa' };

function optionalText(value, max, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, `El campo ${label} no es valido.`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `El campo ${label} debe tener maximo ${max} caracteres.`);
  return text || null;
}

async function latestFile(userId, kind) {
  const { rows } = await db.query(
    `SELECT * FROM archivos WHERE usuario_id = $1 AND tipo = $2 AND entidad = 'usuario'
     ORDER BY subido_en DESC LIMIT 1`,
    [userId, kind]
  );
  return publicFile(rows[0]);
}

async function loadProfile(userId) {
  const user = (await db.query('SELECT id, nombre, email, tipo, telefono, creado_en FROM usuarios WHERE id = $1', [userId])).rows[0];
  if (!user) throw new HttpError(401, 'La cuenta ya no existe. Inicia sesion nuevamente.');
  const row = (await db.query(`SELECT * FROM ${TABLE[user.tipo]} WHERE usuario_id = $1`, [userId])).rows[0] || {};
  const profile = Object.fromEntries(Object.entries(FIELDS[user.tipo]).map(([apiName, [column]]) => [apiName, row[column] ?? null]));
  const isCompany = user.tipo === 'empresa';
  return {
    user: { id: user.id, name: user.nombre, email: user.email, type: user.tipo, phone: user.telefono, created_at: user.creado_en },
    profile,
    avatar: await latestFile(userId, isCompany ? 'logo' : 'foto_perfil'),
    cv: isCompany ? null : await latestFile(userId, 'cv'),
  };
}

// GET /api/profile
async function get(req, res) {
  res.json(await loadProfile(req.auth.sub));
}

// PUT /api/profile
async function update(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'El nombre debe tener entre 2 y 120 caracteres.');
  const phone = optionalText(body.phone, 30, 'telefono');
  if (phone && !/^[+\d\s()-]{7,30}$/.test(phone)) throw new HttpError(400, 'El telefono solo puede tener numeros, espacios y los simbolos + ( ) -.');

  const { rows } = await db.query('SELECT tipo FROM usuarios WHERE id = $1', [req.auth.sub]);
  const type = rows[0]?.tipo;
  if (!type) throw new HttpError(401, 'La cuenta ya no existe. Inicia sesion nuevamente.');

  const values = {};
  for (const [apiName, [column, max]] of Object.entries(FIELDS[type])) {
    values[column] = optionalText(body[apiName], max, apiName);
  }
  if (type === 'empresa' && !values.nombre_empresa) throw new HttpError(400, 'El nombre de la empresa es obligatorio.');
  if (values.sitio_web && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(values.sitio_web)) {
    throw new HttpError(400, 'El sitio web debe empezar por http:// o https://.');
  }

  const columns = Object.keys(values);
  await db.transaction(async (client) => {
    await client.query('UPDATE usuarios SET nombre = $1, telefono = $2 WHERE id = $3', [name, phone, req.auth.sub]);
    // Las columnas salen de FIELDS (lista fija), nunca del cuerpo de la peticion.
    await client.query(
      `INSERT INTO ${TABLE[type]} (usuario_id, ${columns.join(', ')})
       VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (usuario_id) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`,
      [req.auth.sub, ...columns.map((c) => values[c])]
    );
  });
  res.json(await loadProfile(req.auth.sub));
}

module.exports = { get, update };

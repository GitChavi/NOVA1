// Persistencia dual: el fichero va al almacenamiento (Supabase o disco) y sus metadatos
// (nombre, peso, ruta, tipo MIME, fecha, autor) a la tabla archivos, en la misma operacion.
const { randomUUID } = require('crypto');
const db = require('../db');
const storage = require('./storage.service');
const { HttpError } = require('../utils/http-error');

// Que formatos acepta cada tipo de archivo del negocio.
const KINDS = {
  cv: { label: 'La hoja de vida', formats: ['pdf'] },
  logo: { label: 'El logo', formats: ['png', 'jpg', 'webp'] },
  foto_perfil: { label: 'La foto de perfil', formats: ['png', 'jpg', 'webp'] },
};

const FORMATS = {
  pdf: { mime: 'application/pdf', name: 'PDF' },
  png: { mime: 'image/png', name: 'PNG' },
  jpg: { mime: 'image/jpeg', name: 'JPG' },
  webp: { mime: 'image/webp', name: 'WEBP' },
};

// No se confia en el Content-Type ni en la extension que envia el cliente:
// el formato se deduce de los primeros bytes del fichero ("numeros magicos").
function detectFormat(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function cleanOriginalName(name) {
  const base = String(name || 'archivo').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return (base || 'archivo').slice(0, 255);
}

function publicFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.tipo,
    original_name: row.nombre_original,
    size_bytes: Number(row.peso_bytes),
    mime_type: row.mime_type,
    uploaded_at: row.subido_en,
    url: `/api/files/${row.id}/download`,
  };
}

// Valida, sube y registra un archivo. Se usa dentro de transactionWithFiles.
async function storeFile(client, savedKeys, { userId, kind, entity, entityId = null, file }) {
  const rules = KINDS[kind];
  if (!rules) throw new HttpError(400, 'Tipo de archivo no valido.');
  if (!file || !file.buffer?.length) throw new HttpError(400, 'Adjunta un archivo en el campo "archivo".');

  const format = detectFormat(file.buffer);
  if (!format || !rules.formats.includes(format)) {
    const allowed = rules.formats.map((f) => FORMATS[f].name).join(', ');
    throw new HttpError(415, `${rules.label} debe ser un archivo ${allowed}.`);
  }

  // Nombre unico (UUID): dos usuarios que suben "cv.pdf" nunca se sobrescriben.
  const key = `${kind}/${userId}/${randomUUID()}.${format}`;
  await storage.save(key, file.buffer, FORMATS[format].mime);
  savedKeys.push(key);

  const { rows } = await client.query(
    `INSERT INTO archivos (usuario_id, tipo, entidad, entidad_id, nombre_original, ruta_almacenamiento,
                           peso_bytes, mime_type, proveedor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, kind, entity, entityId, cleanOriginalName(file.originalname), key, file.buffer.length, FORMATS[format].mime, storage.driver]
  );
  return rows[0];
}

// Transaccion de base de datos que tambien "deshace" los ficheros subidos si algo falla,
// para que nunca quede un fichero sin registro ni un registro sin fichero.
async function transactionWithFiles(fn) {
  const savedKeys = [];
  try {
    return await db.transaction((client) => fn(client, (options) => storeFile(client, savedKeys, options)));
  } catch (error) {
    await Promise.all(savedKeys.map((key) => storage.remove(key).catch((e) => console.error('No se pudo limpiar', key, e.message))));
    throw error;
  }
}

// Borra ficheros del almacenamiento despues de que la base de datos confirmo el borrado.
async function removeStoredFiles(rows) {
  await Promise.all(rows.filter(Boolean).map((row) => storage.remove(row.ruta_almacenamiento)
    .catch((e) => console.error('Fichero huerfano en almacenamiento:', row.ruta_almacenamiento, e.message))));
}

module.exports = { KINDS, publicFile, transactionWithFiles, removeStoredFiles, detectFormat };

const db = require('../db');
const { publicFile, transactionWithFiles, removeStoredFiles } = require('../services/files.service');
const { HttpError, validId } = require('../utils/http-error');

const TO_DB = { sent: 'enviada', in_review: 'en_revision', rejected: 'rechazada', accepted: 'aceptada' };
const FROM_DB = Object.fromEntries(Object.entries(TO_DB).map(([api, dbValue]) => [dbValue, api]));

const FILE_COLUMNS = `a.id AS cv_id, a.tipo AS cv_tipo, a.nombre_original AS cv_nombre, a.peso_bytes AS cv_peso,
  a.mime_type AS cv_mime, a.subido_en AS cv_subido`;

function cvFromRow(row) {
  if (!row.cv_id) return null;
  return publicFile({
    id: row.cv_id, tipo: row.cv_tipo, nombre_original: row.cv_nombre,
    peso_bytes: row.cv_peso, mime_type: row.cv_mime, subido_en: row.cv_subido,
  });
}

function applicationFromRow(row) {
  return {
    id: row.id,
    job_id: row.vacante_id,
    job_title: row.vacante_titulo,
    company_name: row.nombre_empresa,
    job_status: row.vacante_estado ? { activa: 'active', cerrada: 'closed', borrador: 'draft' }[row.vacante_estado] : undefined,
    status: FROM_DB[row.estado],
    message: row.mensaje,
    created_at: row.creado_en,
    updated_at: row.actualizado_en,
    cv: cvFromRow(row),
  };
}

async function candidateProfileId(client, userId) {
  const { rows } = await client.query('SELECT id FROM perfiles_candidato WHERE usuario_id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'No se encontro tu perfil de candidato.');
  return rows[0].id;
}

async function findMine(client, applicationId) {
  const { rows } = await client.query(
    `SELECT p.*, v.titulo AS vacante_titulo, v.estado AS vacante_estado, pe.nombre_empresa, ${FILE_COLUMNS}
     FROM postulaciones p
     JOIN vacantes v ON v.id = p.vacante_id
     JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id
     LEFT JOIN archivos a ON a.id = p.cv_archivo_id
     WHERE p.id = $1`,
    [applicationId]
  );
  return rows[0];
}

// POST /api/applications  (candidato, multipart/form-data)
// Campos: job_id, message (opcional) y archivo (PDF) o cv_file_id (hoja de vida guardada en el perfil).
async function create(req, res) {
  const jobId = req.body?.job_id;
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const savedCvId = req.body?.cv_file_id;
  if (!validId(jobId)) throw new HttpError(400, 'Indica una vacante valida.');
  if (message.length > 2000) throw new HttpError(400, 'El mensaje debe tener maximo 2000 caracteres.');
  if (!req.file && !validId(savedCvId)) throw new HttpError(400, 'Adjunta tu hoja de vida en PDF.');

  let created;
  try {
    created = await transactionWithFiles(async (client, storeFile) => {
      const job = await client.query(
        `SELECT id FROM vacantes WHERE id = $1 AND estado = 'activa'
           AND (fecha_cierre IS NULL OR fecha_cierre >= CURRENT_DATE)`,
        [jobId]
      );
      if (!job.rowCount) throw new HttpError(404, 'La vacante no existe o ya no recibe postulaciones.');
      const profileId = await candidateProfileId(client, req.auth.sub);

      const inserted = await client.query(
        'INSERT INTO postulaciones (vacante_id, candidato_id, mensaje) VALUES ($1, $2, $3) RETURNING id',
        [jobId, profileId, message || null]
      );
      const applicationId = inserted.rows[0].id;

      let cvId;
      if (req.file) {
        const stored = await storeFile({ userId: req.auth.sub, kind: 'cv', entity: 'postulacion', entityId: applicationId, file: req.file });
        cvId = stored.id;
      } else {
        const own = await client.query(
          "SELECT id FROM archivos WHERE id = $1 AND usuario_id = $2 AND tipo = 'cv'",
          [savedCvId, req.auth.sub]
        );
        if (!own.rowCount) throw new HttpError(400, 'La hoja de vida seleccionada no existe en tu perfil.');
        cvId = own.rows[0].id;
      }
      await client.query('UPDATE postulaciones SET cv_archivo_id = $1 WHERE id = $2', [cvId, applicationId]);
      return findMine(client, applicationId);
    });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'Ya te postulaste a esta vacante.');
    throw error;
  }
  res.status(201).json({ application: applicationFromRow(created) });
}

// GET /api/applications/mine  (candidato): historial de postulaciones
async function listMine(req, res) {
  const profileId = await candidateProfileId(db, req.auth.sub);
  const { rows } = await db.query(
    `SELECT p.*, v.titulo AS vacante_titulo, v.estado AS vacante_estado, pe.nombre_empresa, ${FILE_COLUMNS}
     FROM postulaciones p
     JOIN vacantes v ON v.id = p.vacante_id
     JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id
     LEFT JOIN archivos a ON a.id = p.cv_archivo_id
     WHERE p.candidato_id = $1
     ORDER BY p.creado_en DESC`,
    [profileId]
  );
  res.json({ applications: rows.map(applicationFromRow) });
}

// DELETE /api/applications/:id  (candidato): retirar la postulacion
async function withdraw(req, res) {
  if (!validId(req.params.id)) throw new HttpError(400, 'El identificador no es valido.');
  const removedFiles = await db.transaction(async (client) => {
    const profileId = await candidateProfileId(client, req.auth.sub);
    const { rows } = await client.query(
      'DELETE FROM postulaciones WHERE id = $1 AND candidato_id = $2 RETURNING id, cv_archivo_id',
      [req.params.id, profileId]
    );
    if (!rows[0]) throw new HttpError(404, 'No se encontro una postulacion tuya con ese identificador.');
    // La hoja de vida subida solo para esta postulacion se borra con ella; la del perfil se conserva.
    const files = await client.query(
      "DELETE FROM archivos WHERE entidad = 'postulacion' AND entidad_id = $1 RETURNING *",
      [rows[0].id]
    );
    return files.rows;
  });
  await removeStoredFiles(removedFiles);
  res.status(204).end();
}

// GET /api/jobs/:id/applications  (empresa duena de la vacante)
async function listForJob(req, res) {
  if (!validId(req.params.id)) throw new HttpError(400, 'El identificador no es valido.');
  const job = await db.query('SELECT empresa_id FROM vacantes WHERE id = $1', [req.params.id]);
  if (!job.rows[0] || String(job.rows[0].empresa_id) !== String(req.auth.sub)) {
    throw new HttpError(404, 'No se encontro una vacante tuya con ese identificador.');
  }
  const { rows } = await db.query(
    `SELECT p.id, p.estado, p.mensaje, p.creado_en, p.actualizado_en,
            u.nombre, u.email, u.telefono, pc.titulo_profesional, pc.ubicacion, pc.resumen,
            (SELECT f.id FROM archivos f WHERE f.usuario_id = u.id AND f.tipo = 'foto_perfil'
              ORDER BY f.subido_en DESC LIMIT 1) AS foto_id,
            ${FILE_COLUMNS}
     FROM postulaciones p
     JOIN perfiles_candidato pc ON pc.id = p.candidato_id
     JOIN usuarios u ON u.id = pc.usuario_id
     LEFT JOIN archivos a ON a.id = p.cv_archivo_id
     WHERE p.vacante_id = $1
     ORDER BY p.creado_en DESC`,
    [req.params.id]
  );
  res.json({
    applications: rows.map((row) => ({
      id: row.id,
      status: FROM_DB[row.estado],
      message: row.mensaje,
      created_at: row.creado_en,
      updated_at: row.actualizado_en,
      candidate: {
        name: row.nombre, email: row.email, phone: row.telefono,
        title: row.titulo_profesional, location: row.ubicacion, summary: row.resumen,
        photo_url: row.foto_id ? `/api/files/${row.foto_id}/download` : null,
      },
      cv: cvFromRow(row),
    })),
  });
}

// PATCH /api/applications/:id/status  (empresa duena de la vacante)
async function updateStatus(req, res) {
  if (!validId(req.params.id)) throw new HttpError(400, 'El identificador no es valido.');
  const status = req.body?.status;
  if (!Object.prototype.hasOwnProperty.call(TO_DB, status)) {
    throw new HttpError(400, `El estado debe ser uno de: ${Object.keys(TO_DB).join(', ')}.`);
  }
  const { rows } = await db.query(
    `UPDATE postulaciones p SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
     FROM vacantes v
     WHERE p.id = $2 AND v.id = p.vacante_id AND v.empresa_id = $3
     RETURNING p.id, p.estado, p.actualizado_en`,
    [TO_DB[status], req.params.id, req.auth.sub]
  );
  if (!rows[0]) throw new HttpError(404, 'No se encontro esa postulacion en tus vacantes.');
  res.json({ application: { id: rows[0].id, status: FROM_DB[rows[0].estado], updated_at: rows[0].actualizado_en } });
}

module.exports = { create, listMine, withdraw, listForJob, updateStatus };

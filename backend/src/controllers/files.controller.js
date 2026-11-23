const db = require('../db');
const storage = require('../services/storage.service');
const { publicFile, transactionWithFiles, removeStoredFiles } = require('../services/files.service');
const { HttpError, validId } = require('../utils/http-error');

// Que puede subir cada rol desde su perfil.
const PROFILE_KINDS = { candidato: ['foto_perfil', 'cv'], empresa: ['logo'] };

// POST /api/files  (multipart/form-data: tipo + archivo)
// Sube la foto, el logo o la hoja de vida del perfil. Reemplaza la anterior del mismo tipo
// salvo que alguna postulacion la siga usando (esas se conservan como historial).
async function uploadProfileFile(req, res) {
  const kind = String(req.body?.tipo || '');
  const allowed = PROFILE_KINDS[req.auth.userType] || [];
  if (!allowed.includes(kind)) {
    throw new HttpError(400, `Tipo no permitido para tu cuenta. Usa: ${allowed.join(', ')}.`);
  }

  const { file, replaced } = await transactionWithFiles(async (client, storeFile) => {
    const previous = await client.query(
      `DELETE FROM archivos a
       WHERE a.usuario_id = $1 AND a.tipo = $2 AND a.entidad = 'usuario'
         AND NOT EXISTS (SELECT 1 FROM postulaciones p WHERE p.cv_archivo_id = a.id)
       RETURNING *`,
      [req.auth.sub, kind]
    );
    const stored = await storeFile({ userId: req.auth.sub, kind, entity: 'usuario', entityId: req.auth.sub, file: req.file });
    return { file: stored, replaced: previous.rows };
  });
  await removeStoredFiles(replaced);
  res.status(201).json({ file: publicFile(file) });
}

// GET /api/files/mine
async function listMine(req, res) {
  const { rows } = await db.query(
    `SELECT a.*, (SELECT count(*) FROM postulaciones p WHERE p.cv_archivo_id = a.id)::int AS usos
     FROM archivos a WHERE a.usuario_id = $1 ORDER BY a.subido_en DESC`,
    [req.auth.sub]
  );
  res.json({ files: rows.map((row) => ({ ...publicFile(row), used_in_applications: row.usos })) });
}

// Una empresa puede ver la hoja de vida y la foto de quien se postulo a sus vacantes.
async function companyCanSee(companyId, candidateUserId) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM postulaciones p
     JOIN perfiles_candidato pc ON pc.id = p.candidato_id
     JOIN vacantes v ON v.id = p.vacante_id
     WHERE pc.usuario_id = $1 AND v.empresa_id = $2 LIMIT 1`,
    [candidateUserId, companyId]
  );
  return rowCount > 0;
}

// GET /api/files/:id/download[?download=1]
async function download(req, res) {
  if (!validId(req.params.id)) throw new HttpError(400, 'El identificador no es valido.');
  const { rows } = await db.query('SELECT * FROM archivos WHERE id = $1', [req.params.id]);
  const file = rows[0];
  if (!file) throw new HttpError(404, 'No se encontro el archivo.');

  const isPublic = file.tipo === 'logo';
  const requester = req.auth ? Number(req.auth.sub) : null;
  if (!isPublic) {
    if (!requester) throw new HttpError(401, 'Debes iniciar sesion para ver este archivo.');
    const isOwner = requester === file.usuario_id;
    if (!isOwner && !(await companyCanSee(requester, file.usuario_id))) {
      throw new HttpError(403, 'No tienes permiso para ver este archivo.');
    }
  }

  const asAttachment = req.query.download === '1';
  res.set('Cache-Control', isPublic ? 'public, max-age=300' : 'private, no-store');
  if (file.proveedor === 'supabase') {
    if (storage.driver !== 'supabase') throw new HttpError(503, 'El almacenamiento en la nube no esta configurado en este servidor.');
    return res.redirect(302, await storage.signedUrl(file.ruta_almacenamiento, asAttachment ? file.nombre_original : undefined));
  }
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(file.mime_type);
  res.set('Content-Disposition', `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.nombre_original)}`);
  return res.sendFile(storage.localPath(file.ruta_almacenamiento), (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'El fichero ya no esta disponible en el almacenamiento.' });
  });
}

// DELETE /api/files/:id
async function remove(req, res) {
  if (!validId(req.params.id)) throw new HttpError(400, 'El identificador no es valido.');
  const deleted = await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM archivos WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [req.params.id, req.auth.sub]);
    if (!rows[0]) throw new HttpError(404, 'No se encontro un archivo tuyo con ese identificador.');
    const inUse = await client.query('SELECT 1 FROM postulaciones WHERE cv_archivo_id = $1 LIMIT 1', [req.params.id]);
    if (inUse.rowCount) throw new HttpError(409, 'Esta hoja de vida esta adjunta a una postulacion. Retira la postulacion para borrarla.');
    await client.query('DELETE FROM archivos WHERE id = $1', [req.params.id]);
    return rows[0];
  });
  await removeStoredFiles([deleted]);
  res.status(204).end();
}

module.exports = { uploadProfileFile, listMine, download, remove };

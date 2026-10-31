const db = require('../db');

const columns = `v.id, v.empresa_id AS company_id, v.titulo AS title, v.descripcion AS description,
  v.categoria AS category, v.ubicacion AS location, v.modalidad AS modality,
  v.salario_min AS salary_min, v.salario_max AS salary_max,
  v.experiencia_minima AS minimum_experience, v.tipo_contrato AS contract_type,
  v.jornada AS work_schedule, v.numero_vacantes AS openings, v.fecha_cierre AS closing_date,
  CASE v.estado WHEN 'activa' THEN 'active' WHEN 'cerrada' THEN 'closed' ELSE 'draft' END AS status,
  v.creado_en AS created_at, pe.nombre_empresa AS company_name`;

function cleanText(value, maxLength) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().slice(0, maxLength + 1);
}

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : false;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validId(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function parseJob(body) {
  const data = body && typeof body === 'object' ? body : {};
  const job = {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    description: typeof data.description === 'string' ? data.description.trim() : '',
    category: cleanText(data.category, 120),
    location: cleanText(data.location, 120),
    modality: cleanText(data.modality, 60),
    salaryMin: optionalNumber(data.salary_min),
    salaryMax: optionalNumber(data.salary_max),
    minimumExperience: cleanText(data.minimum_experience, 120),
    contractType: cleanText(data.contract_type, 80),
    workSchedule: cleanText(data.work_schedule, 80),
    openings: data.openings == null || data.openings === '' ? 1 : Number(data.openings),
    closingDate: data.closing_date || null,
    status: data.status || 'draft',
  };

  if (!job.title || job.title.length > 180) return { error: 'El titulo es obligatorio y debe tener maximo 180 caracteres.' };
  if (!job.description || job.description.length > 12000) return { error: 'La descripcion es obligatoria y debe tener maximo 12000 caracteres.' };
  for (const [field, limit] of Object.entries({ category: 120, location: 120, modality: 60, minimumExperience: 120, contractType: 80, workSchedule: 80 })) {
    if (job[field] && job[field].length > limit) return { error: `El campo ${field} excede su longitud maxima.` };
  }
  if (job.salaryMin === false || job.salaryMax === false || (job.salaryMin != null && job.salaryMin < 0) || (job.salaryMax != null && job.salaryMax < 0)) {
    return { error: 'Los salarios deben ser numeros validos y no negativos.' };
  }
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
    return { error: 'El salario minimo no puede superar al maximo.' };
  }
  if (!Number.isInteger(job.openings) || job.openings < 1) return { error: 'El numero de vacantes debe ser un entero mayor que cero.' };
  const dbStatuses = { active: 'activa', closed: 'cerrada', draft: 'borrador' };
  if (!Object.prototype.hasOwnProperty.call(dbStatuses, job.status)) return { error: 'El estado de la vacante no es valido.' };
  if (job.closingDate && !validDate(job.closingDate)) return { error: 'La fecha de cierre no es valida.' };
  job.dbStatus = dbStatuses[job.status];
  return { job };
}

async function listActive(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const result = await db.query(
      `SELECT ${columns} FROM vacantes v
       JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id
       WHERE v.estado = 'activa'
         AND ($1 = '' OR v.titulo ILIKE $2 OR v.descripcion ILIKE $2 OR v.categoria ILIKE $2)
       ORDER BY v.creado_en DESC`,
      [q, `%${q}%`]
    );
    return res.json({ jobs: result.rows });
  } catch (error) {
    console.error('List jobs error:', error.message);
    return res.status(500).json({ error: 'No se pudieron cargar las vacantes.' });
  }
}

async function listMine(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const result = await db.query(
      `SELECT ${columns} FROM vacantes v
       JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id
       WHERE v.empresa_id = $1
         AND ($2 = '' OR v.titulo ILIKE $3 OR v.descripcion ILIKE $3 OR v.categoria ILIKE $3)
       ORDER BY v.creado_en DESC`,
      [req.auth.sub, q, `%${q}%`]
    );
    return res.json({ jobs: result.rows });
  } catch (error) {
    console.error('List company jobs error:', error.message);
    return res.status(500).json({ error: 'No se pudieron cargar tus vacantes.' });
  }
}

async function getOne(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'El identificador no es valido.' });
  try {
    const result = await db.query(
      `SELECT ${columns} FROM vacantes v
       JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id
       WHERE v.id = $1 AND v.estado = 'activa'`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No se encontro la vacante.' });
    return res.json({ job: result.rows[0] });
  } catch (error) {
    console.error('Get job error:', error.message);
    return res.status(500).json({ error: 'No se pudo cargar la vacante.' });
  }
}

async function create(req, res) {
  const parsed = parseJob(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const j = parsed.job;
  try {
    const inserted = await db.query(
      `INSERT INTO vacantes (
        empresa_id, titulo, descripcion, categoria, ubicacion, modalidad, salario_min,
        salario_max, experiencia_minima, tipo_contrato, jornada, numero_vacantes,
        fecha_cierre, estado
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [req.auth.sub, j.title, j.description, j.category, j.location, j.modality, j.salaryMin,
        j.salaryMax, j.minimumExperience, j.contractType, j.workSchedule, j.openings, j.closingDate, j.dbStatus]
    );
    const created = await db.query(
      `SELECT ${columns} FROM vacantes v JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id WHERE v.id = $1`,
      [inserted.rows[0].id]
    );
    return res.status(201).json({ job: created.rows[0] });
  } catch (error) {
    console.error('Create job error:', error.message);
    return res.status(500).json({ error: 'No se pudo crear la vacante.' });
  }
}

async function update(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'El identificador no es valido.' });
  const parsed = parseJob(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const j = parsed.job;
  try {
    const updated = await db.query(
      `UPDATE vacantes SET titulo=$1, descripcion=$2, categoria=$3, ubicacion=$4,
         modalidad=$5, salario_min=$6, salario_max=$7, experiencia_minima=$8,
         tipo_contrato=$9, jornada=$10, numero_vacantes=$11, fecha_cierre=$12, estado=$13
       WHERE id=$14 AND empresa_id=$15 RETURNING id`,
      [j.title, j.description, j.category, j.location, j.modality, j.salaryMin, j.salaryMax,
        j.minimumExperience, j.contractType, j.workSchedule, j.openings, j.closingDate,
        j.dbStatus, req.params.id, req.auth.sub]
    );
    if (!updated.rows[0]) return res.status(404).json({ error: 'No se encontro una vacante tuya con ese identificador.' });
    const result = await db.query(
      `SELECT ${columns} FROM vacantes v JOIN perfiles_empresa pe ON pe.usuario_id = v.empresa_id WHERE v.id = $1`,
      [req.params.id]
    );
    return res.json({ job: result.rows[0] });
  } catch (error) {
    console.error('Update job error:', error.message);
    return res.status(500).json({ error: 'No se pudo actualizar la vacante.' });
  }
}

async function remove(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'El identificador no es valido.' });
  try {
    const result = await db.query('DELETE FROM vacantes WHERE id=$1 AND empresa_id=$2 RETURNING id', [req.params.id, req.auth.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: 'No se encontro una vacante tuya con ese identificador.' });
    return res.status(204).end();
  } catch (error) {
    console.error('Delete job error:', error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la vacante.' });
  }
}

module.exports = { listActive, listMine, getOne, create, update, remove };
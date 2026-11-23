// Panel privado. Empresa: CRUD de vacantes y revision de postulantes.
// Candidato: buscar vacantes, postularse con hoja de vida e historial de postulaciones.
// Requiere api.js.

const state = { user: null, jobs: [], applications: [], savedCv: null, applicantsJob: null };
const $ = (id) => document.getElementById(id);
const isCompany = () => state.user?.type === 'empresa';

function salaryLabel(job) {
  const format = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  if (job.salary_min == null && job.salary_max == null) return 'Salario no especificado';
  if (job.salary_min != null && job.salary_max != null && Number(job.salary_min) !== Number(job.salary_max)) {
    return `${format.format(job.salary_min)} – ${format.format(job.salary_max)}`;
  }
  return format.format(job.salary_min ?? job.salary_max);
}

function statusPill(status) {
  return el('span', `status-pill status-${status}`, APPLICATION_STATUS[status] || status);
}

function cvLink(cv, label = 'Ver hoja de vida') {
  const link = el('a', 'file-chip', `${label} · ${formatBytes(cv.size_bytes)}`);
  link.href = fileUrl(cv.url);
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = cv.original_name;
  return link;
}

function actionButton(action, label, id, extraClass = '') {
  const button = el('button', `btn btn-outline ${extraClass}`.trim(), label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = String(id);
  return button;
}

// ---------- Vacantes ----------
function renderJob(job) {
  const card = el('article', 'job-card');
  const banner = el('div', 'job-card-banner bg-sky');
  const applied = state.applications.some((a) => a.job_id === job.id);
  const tagText = isCompany() ? ({ active: 'Activa', draft: 'Borrador', closed: 'Cerrada' }[job.status] || job.status) : (applied ? 'Postulada' : 'Oportunidad');
  banner.append(el('span', 'job-card-tag', tagText));
  if (job.company_logo_url) {
    const logo = el('img', 'job-card-logo');
    logo.src = fileUrl(job.company_logo_url);
    logo.alt = `Logo de ${job.company_name}`;
    logo.loading = 'lazy';
    banner.append(logo);
  }

  const body = el('div', 'job-card-body');
  const meta = el('div', 'job-card-meta');
  meta.append(el('span', null, [job.modality, job.location].filter(Boolean).join(' · ') || 'Ubicación no especificada'), el('strong', null, salaryLabel(job)));
  body.append(el('h3', null, job.title), el('p', null, job.company_name || 'Empresa'), el('p', 'job-description', job.description), meta);
  if (job.closing_date) body.append(el('p', 'job-closing', `Cierra el ${formatDate(job.closing_date)}`));
  card.append(banner, body);

  const actions = el('div', 'job-card-actions');
  if (isCompany()) {
    const count = job.applications_count || 0;
    actions.append(
      actionButton('applicants', `Postulantes (${count})`, job.id, 'btn-strong'),
      actionButton('edit', 'Editar', job.id),
      actionButton('delete', 'Eliminar', job.id),
    );
  } else if (applied) {
    const done = actionButton('applied', 'Ya te postulaste', job.id);
    done.disabled = true;
    actions.append(done);
  } else {
    actions.append(actionButton('apply', 'Postularme', job.id, 'btn-strong'));
  }
  card.append(actions);
  return card;
}

function renderJobs() {
  const list = $('jobsList');
  list.replaceChildren(...state.jobs.map(renderJob));
  $('jobsCount').textContent = `${state.jobs.length} vacante${state.jobs.length === 1 ? '' : 's'}`;
  $('jobsMessage').textContent = state.jobs.length ? '' : (isCompany() ? 'Aún no has publicado vacantes.' : 'No hay vacantes activas para esta búsqueda.');
  updateStats();
}

async function loadJobs() {
  const q = $('jobSearch').value.trim();
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const base = isCompany() ? '/api/jobs/mine' : '/api/jobs';
  $('jobsList').setAttribute('aria-busy', 'true');
  $('jobsMessage').textContent = 'Cargando vacantes…';
  try {
    const data = await apiRequest(`${base}${params.size ? `?${params}` : ''}`);
    state.jobs = data.jobs;
    renderJobs();
  } catch (error) {
    $('jobsMessage').textContent = error.message;
    if (error.status === 401) window.location.replace('./login.html');
  } finally {
    $('jobsList').removeAttribute('aria-busy');
  }
}

function updateStats() {
  if (isCompany()) {
    $('statOne').textContent = String(state.jobs.length);
    $('statTwo').textContent = String(state.jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0));
  } else {
    $('statOne').textContent = String(state.jobs.length);
    $('statTwo').textContent = String(state.applications.length);
  }
}

// ---------- Formulario de vacantes (empresa) ----------
function resetJobForm() {
  const form = $('jobForm');
  form.reset();
  form.elements.openings.value = '1';
  form.elements.status.value = 'active';
  form.elements.id.value = '';
  $('jobFormHeading').textContent = 'Publicar una vacante';
  $('saveJob').textContent = 'Publicar vacante';
  $('cancelEdit').hidden = true;
}

function editJob(job) {
  const form = $('jobForm');
  for (const key of ['id', 'title', 'description', 'category', 'location', 'modality', 'salary_min', 'salary_max', 'minimum_experience', 'contract_type', 'work_schedule', 'openings', 'closing_date', 'status']) {
    form.elements[key].value = job[key] ?? '';
  }
  if (job.closing_date) form.elements.closing_date.value = String(job.closing_date).slice(0, 10);
  $('jobFormHeading').textContent = 'Editar vacante';
  $('saveJob').textContent = 'Guardar cambios';
  $('cancelEdit').hidden = false;
  $('jobFormMessage').textContent = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitJob(form) {
  const message = $('jobFormMessage');
  message.classList.remove('success');
  if (!form.reportValidity()) return;
  const min = form.elements.salary_min.value;
  const max = form.elements.salary_max.value;
  if (min && max && Number(min) > Number(max)) {
    message.textContent = 'El salario mínimo no puede superar al máximo.';
    return;
  }
  const button = $('saveJob');
  const original = button.textContent;
  const jobId = form.elements.id.value;
  const payload = Object.fromEntries(new FormData(form).entries());
  delete payload.id;
  for (const key of ['salary_min', 'salary_max']) payload[key] = payload[key] === '' ? null : Number(payload[key]);
  payload.openings = Number(payload.openings);
  payload.closing_date = payload.closing_date || null;
  button.disabled = true;
  button.textContent = jobId ? 'Guardando…' : 'Publicando…';
  try {
    await apiRequest(jobId ? `/api/jobs/${jobId}` : '/api/jobs', { method: jobId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    resetJobForm();
    message.textContent = jobId ? 'Vacante actualizada.' : 'Vacante publicada.';
    message.classList.add('success');
    await loadJobs();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    if (button.textContent.endsWith('…')) button.textContent = original;
  }
}

// ---------- Postulantes (empresa) ----------
function renderApplicant(app) {
  const item = el('li', 'app-item applicant');
  const head = el('div', 'app-head');
  const avatar = el('div', 'app-avatar');
  if (app.candidate.photo_url) {
    const img = el('img');
    img.src = fileUrl(app.candidate.photo_url);
    img.alt = '';
    avatar.append(img);
  } else {
    avatar.textContent = app.candidate.name.trim().charAt(0).toUpperCase();
  }
  const who = el('div', 'app-who');
  who.append(el('strong', null, app.candidate.name), el('span', null, [app.candidate.title, app.candidate.location].filter(Boolean).join(' · ') || 'Perfil sin completar'));
  head.append(avatar, who, statusPill(app.status));

  const contact = el('p', 'app-contact');
  const mail = el('a', null, app.candidate.email);
  mail.href = `mailto:${app.candidate.email}`;
  contact.append(mail);
  if (app.candidate.phone) contact.append(document.createTextNode(` · ${app.candidate.phone}`));

  item.append(head, contact);
  if (app.message) item.append(el('blockquote', 'app-note', app.message));
  if (app.candidate.summary) item.append(el('p', 'app-summary', app.candidate.summary));

  const foot = el('div', 'app-foot');
  foot.append(el('span', 'app-date', `Postulado el ${formatDate(app.created_at)}`));
  if (app.cv) foot.append(cvLink(app.cv));
  const select = el('select', 'status-select');
  select.setAttribute('aria-label', `Estado de la postulación de ${app.candidate.name}`);
  select.dataset.id = String(app.id);
  for (const [value, label] of Object.entries(APPLICATION_STATUS)) {
    const option = el('option', null, label);
    option.value = value;
    option.selected = value === app.status;
    select.append(option);
  }
  foot.append(select);
  item.append(foot);
  return item;
}

async function openApplicants(job) {
  state.applicantsJob = job;
  const section = $('postulantes');
  section.hidden = false;
  $('applicantsHeading').textContent = `Postulantes: ${job.title}`;
  $('applicantsList').replaceChildren();
  $('applicantsMessage').textContent = 'Cargando postulantes…';
  $('applicantsMessage').classList.remove('success');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const data = await apiRequest(`/api/jobs/${job.id}/applications`);
    $('applicantsList').replaceChildren(...data.applications.map(renderApplicant));
    $('applicantsMessage').textContent = data.applications.length ? '' : 'Esta vacante todavía no tiene postulantes.';
  } catch (error) {
    $('applicantsMessage').textContent = error.message;
  }
}

async function changeStatus(select) {
  const previous = [...select.options].find((o) => o.defaultSelected)?.value;
  select.disabled = true;
  try {
    const data = await apiRequest(`/api/applications/${select.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
    [...select.options].forEach((o) => { o.defaultSelected = o.value === data.application.status; });
    const pill = select.closest('.app-item').querySelector('.status-pill');
    pill.replaceWith(statusPill(data.application.status));
    $('applicantsMessage').textContent = 'Estado actualizado.';
    $('applicantsMessage').classList.add('success');
  } catch (error) {
    if (previous) select.value = previous;
    $('applicantsMessage').textContent = error.message;
    $('applicantsMessage').classList.remove('success');
  } finally {
    select.disabled = false;
  }
}

// ---------- Postulaciones (candidato) ----------
function renderApplication(app) {
  const item = el('li', 'app-item');
  const head = el('div', 'app-head');
  const who = el('div', 'app-who');
  who.append(el('strong', null, app.job_title), el('span', null, app.company_name));
  head.append(who, statusPill(app.status));
  item.append(head);
  if (app.message) item.append(el('blockquote', 'app-note', app.message));
  const foot = el('div', 'app-foot');
  foot.append(el('span', 'app-date', `Enviada el ${formatDate(app.created_at)}${app.job_status && app.job_status !== 'active' ? ' · vacante cerrada' : ''}`));
  if (app.cv) foot.append(cvLink(app.cv, 'Hoja de vida enviada'));
  foot.append(actionButton('withdraw', 'Retirar', app.id, 'btn-danger'));
  item.append(foot);
  return item;
}

async function loadApplications() {
  $('applicationsMessage').textContent = 'Cargando tus postulaciones…';
  try {
    const data = await apiRequest('/api/applications/mine');
    state.applications = data.applications;
    $('applicationsList').replaceChildren(...state.applications.map(renderApplication));
    $('applicationsCount').textContent = `${state.applications.length} en total`;
    $('applicationsMessage').textContent = state.applications.length ? '' : 'Todavía no te has postulado. Elige una vacante y pulsa «Postularme».';
    updateStats();
  } catch (error) {
    $('applicationsMessage').textContent = error.message;
  }
}

function openApplyDialog(job) {
  const dialog = $('applyDialog');
  const form = $('applyForm');
  form.reset();
  form.elements.job_id.value = String(job.id);
  $('applyJob').textContent = `${job.title} · ${job.company_name}`;
  $('applyMessage').textContent = '';
  $('savedCvOption').hidden = !state.savedCv;
  if (state.savedCv) {
    $('savedCvName').textContent = state.savedCv.original_name;
    form.elements.cv_source.value = 'saved';
  }
  syncCvSource();
  dialog.showModal();
}

function syncCvSource() {
  const form = $('applyForm');
  const upload = form.elements.cv_source.value !== 'saved';
  $('applyFile').hidden = !upload;
  $('applyFile').required = upload;
}

async function submitApplication(event) {
  event.preventDefault();
  const form = $('applyForm');
  const notice = $('applyMessage');
  const useSaved = form.elements.cv_source.value === 'saved' && state.savedCv;
  const file = $('applyFile').files[0];
  if (!useSaved) {
    const problem = checkFile(file, { accept: ['application/pdf'], label: 'la hoja de vida' });
    if (problem) { notice.textContent = problem; return; }
  }
  // Primero los campos de texto y al final el archivo, como espera multer.
  const data = new FormData();
  data.append('job_id', form.elements.job_id.value);
  data.append('message', form.elements.message.value.trim());
  if (useSaved) data.append('cv_file_id', String(state.savedCv.id));
  else data.append('archivo', file);

  const button = $('applySubmit');
  button.disabled = true;
  button.textContent = useSaved ? 'Enviando…' : 'Subiendo hoja de vida…';
  notice.textContent = '';
  try {
    await apiRequest('/api/applications', { method: 'POST', body: data });
    $('applyDialog').close();
    await loadApplications();
    renderJobs();
    $('applicationsMessage').textContent = 'Postulación enviada. La empresa ya puede ver tu hoja de vida.';
    $('applicationsMessage').classList.add('success');
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Enviar postulación';
  }
}

// ---------- Inicio ----------
async function loadProfileSummary() {
  try {
    const data = await apiRequest('/api/profile');
    if (data.avatar) {
      const img = el('img');
      img.src = fileUrl(data.avatar.url);
      img.alt = '';
      $('userInitial').replaceChildren(img);
    }
    if (!isCompany()) {
      state.savedCv = data.cv;
      $('fileStatus').hidden = false;
      $('fileStatusText').textContent = data.cv
        ? `Guardada: ${data.cv.original_name} (${formatBytes(data.cv.size_bytes)}). Puedes usarla al postularte.`
        : 'Aún no has guardado una hoja de vida. Súbela en tu perfil para postularte más rápido.';
    } else if (!data.avatar) {
      $('fileStatus').hidden = false;
      $('fileStatusTitle').textContent = 'Logo de la empresa';
      $('fileStatusText').textContent = 'Sube el logo de tu empresa para que aparezca en tus vacantes.';
    }
    const incomplete = isCompany() ? !data.profile.description : !data.profile.title;
    $('promoText').textContent = incomplete
      ? (isCompany() ? 'Completa el perfil de tu empresa y sube tu logo' : 'Completa tu perfil y guarda tu hoja de vida')
      : 'Mantén tu perfil al día';
  } catch (_error) {
    // El resumen del perfil es complementario: si falla, el panel sigue funcionando.
  }
}

function bindEvents() {
  const form = $('jobForm');
  form.addEventListener('submit', (event) => { event.preventDefault(); submitJob(form); });
  $('cancelEdit').addEventListener('click', () => { resetJobForm(); $('jobFormMessage').textContent = ''; });
  $('searchJobs').addEventListener('click', loadJobs);
  $('jobSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); loadJobs(); } });
  $('closeApplicants').addEventListener('click', () => { $('postulantes').hidden = true; state.applicantsJob = null; });

  $('jobsList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const job = state.jobs.find((item) => String(item.id) === button.dataset.id);
    if (!job) return;
    if (button.dataset.action === 'edit') editJob(job);
    if (button.dataset.action === 'applicants') openApplicants(job);
    if (button.dataset.action === 'apply') openApplyDialog(job);
    if (button.dataset.action === 'delete' && window.confirm(`¿Eliminar «${job.title}»? También se borrarán sus postulaciones. Esta acción no se puede deshacer.`)) {
      button.disabled = true;
      try {
        await apiRequest(`/api/jobs/${job.id}`, { method: 'DELETE' });
        if (state.applicantsJob?.id === job.id) $('postulantes').hidden = true;
        await loadJobs();
      } catch (error) {
        $('jobsMessage').textContent = error.message;
        button.disabled = false;
      }
    }
  });

  $('applicantsList').addEventListener('change', (event) => {
    if (event.target.matches('.status-select')) changeStatus(event.target);
  });

  $('applicationsList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="withdraw"]');
    if (!button || !window.confirm('¿Retirar esta postulación? La empresa dejará de verla.')) return;
    button.disabled = true;
    try {
      await apiRequest(`/api/applications/${button.dataset.id}`, { method: 'DELETE' });
      await loadApplications();
      renderJobs();
    } catch (error) {
      $('applicationsMessage').textContent = error.message;
      button.disabled = false;
    }
  });

  const dialog = $('applyDialog');
  $('applyForm').addEventListener('submit', submitApplication);
  $('applyForm').addEventListener('change', (event) => { if (event.target.name === 'cv_source') syncCvSource(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog || event.target.closest('[data-close]')) dialog.close(); });
}

async function initDashboard(user) {
  state.user = user;
  const company = isCompany();
  $('greetName').textContent = user.name;
  $('userName').textContent = user.name;
  $('userInitial').textContent = user.name.trim().charAt(0).toUpperCase();
  $('profileEmail').textContent = user.email;
  $('accountType').textContent = company ? 'Empresa' : 'Candidato';
  $('accountHint').textContent = company
    ? 'Publica vacantes, revisa las hojas de vida recibidas y actualiza el estado de cada postulante.'
    : 'Postúlate con tu hoja de vida en PDF y sigue el estado de cada postulación.';
  $('roleDescription').textContent = company ? 'Administra las vacantes de tu empresa y sus postulantes.' : 'Explora las oportunidades laborales disponibles.';
  $('companyTools').hidden = !company;
  $('postulaciones').hidden = company;
  $('navApplications').hidden = company;
  $('jobsHeading').textContent = company ? 'Mis vacantes' : 'Vacantes activas';
  $('statOneLabel').textContent = company ? 'Vacantes' : 'Vacantes activas';
  $('statTwoLabel').textContent = company ? 'Postulantes' : 'Mis postulaciones';

  bindEvents();
  bindLogout();
  await Promise.all([loadProfileSummary(), company ? null : loadApplications()]);
  await loadJobs();
  document.documentElement.classList.remove('is-loading');
  $('pageLoader')?.classList.add('is-hidden');
}

document.addEventListener('DOMContentLoaded', () => guardPrivatePage(initDashboard));

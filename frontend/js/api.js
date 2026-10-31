const API_URL = window.NOVA_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch (_error) {
    throw new Error('No se pudo conectar con NOVA. Comprueba que el backend este iniciado.');
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Ocurrio un error. Intenta nuevamente.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function setNotice(form, text, success = false) {
  const notice = form.querySelector('.form-message');
  if (!notice) return;
  notice.textContent = text;
  notice.classList.toggle('success', success);
}

function passwordIsValid(value) {
  return value.length >= 6 && value.length <= 72 && /[A-Z]/.test(value) && /[0-9]/.test(value);
}

async function submitAuth(form, isRegister) {
  if (!form.reportValidity()) return;
  const password = form.elements.password.value;
  if (isRegister && !passwordIsValid(password)) {
    setNotice(form, 'La contrasena requiere minimo 6 caracteres, una mayuscula y un numero.');
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  const label = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = isRegister ? 'Creando cuenta…' : 'Iniciando sesión…'; }
  const payload = { email: form.elements.email.value.trim(), password };
  if (isRegister) {
    payload.name = form.elements.name.value.trim();
    payload.type = form.elements.role.value;
  }
  try {
    await apiRequest(`/api/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(payload) });
    setNotice(form, isRegister ? 'Cuenta creada. Abriendo tu espacio…' : 'Inicio correcto. Abriendo tu espacio…', true);
    const overlay = document.getElementById(isRegister ? 'registerOverlay' : 'successOverlay');
    overlay?.classList.add('is-active');
    window.setTimeout(() => window.location.replace('./dashboard.html'), 500);
  } catch (error) {
    setNotice(form, error.message);
    if (submit) { submit.disabled = false; submit.textContent = label; }
  }
}

let currentUser = null;
let currentJobs = [];

function salaryLabel(job) {
  const format = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  if (job.salary_min == null && job.salary_max == null) return 'Salario no especificado';
  if (job.salary_min != null && job.salary_max != null) return `${format.format(job.salary_min)} – ${format.format(job.salary_max)}`;
  return format.format(job.salary_min ?? job.salary_max);
}

function renderJob(job) {
  const card = document.createElement('article');
  card.className = 'job-card';
  const banner = document.createElement('div');
  banner.className = 'job-card-banner bg-sky';
  const tag = document.createElement('span');
  tag.className = 'job-card-tag';
  tag.textContent = currentUser.type === 'empresa' ? ({ active: 'Activa', draft: 'Borrador', closed: 'Cerrada' }[job.status] || job.status) : 'Oportunidad';
  banner.append(tag);
  const body = document.createElement('div');
  body.className = 'job-card-body';
  const title = document.createElement('h3'); title.textContent = job.title;
  const company = document.createElement('p'); company.textContent = job.company_name || 'Empresa';
  const description = document.createElement('p'); description.className = 'job-description'; description.textContent = job.description;
  const meta = document.createElement('div'); meta.className = 'job-card-meta';
  const location = document.createElement('span'); location.textContent = [job.modality, job.location].filter(Boolean).join(' · ') || 'Ubicación no especificada';
  const salary = document.createElement('strong'); salary.textContent = salaryLabel(job);
  meta.append(location, salary); body.append(title, company, description, meta); card.append(banner, body);
  if (currentUser.type === 'empresa') {
    const actions = document.createElement('div'); actions.className = 'job-card-actions';
    for (const [action, label] of [['edit', 'Editar'], ['delete', 'Eliminar']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-outline';
      button.dataset.action = action; button.dataset.jobId = String(job.id); button.textContent = label; actions.append(button);
    }
    card.append(actions);
  }
  return card;
}

async function loadJobs() {
  const list = document.getElementById('jobsList');
  const notice = document.getElementById('jobsMessage');
  const count = document.getElementById('jobsCount');
  const q = document.getElementById('jobSearch').value.trim();
  const params = new URLSearchParams(); if (q) params.set('q', q);
  const base = currentUser.type === 'empresa' ? '/api/jobs/mine' : '/api/jobs';
  list.replaceChildren(); count.textContent = ''; notice.textContent = 'Cargando vacantes…';
  try {
    const data = await apiRequest(`${base}${params.size ? `?${params}` : ''}`);
    currentJobs = data.jobs;
    currentJobs.forEach((job) => list.append(renderJob(job)));
    count.textContent = `${currentJobs.length} vacante${currentJobs.length === 1 ? '' : 's'}`;
    notice.textContent = currentJobs.length ? '' : (currentUser.type === 'empresa' ? 'Aún no has publicado vacantes.' : 'No hay vacantes activas para esta búsqueda.');
  } catch (error) {
    notice.textContent = error.message;
    if (error.status === 401) window.location.replace('./login.html');
  }
}

function resetJobForm() {
  const form = document.getElementById('jobForm');
  form.reset(); form.elements.openings.value = '1'; form.elements.status.value = 'active'; form.elements.id.value = '';
  document.getElementById('jobFormHeading').textContent = 'Publicar una vacante';
  document.getElementById('saveJob').textContent = 'Publicar vacante';
  document.getElementById('cancelEdit').hidden = true;
  document.getElementById('jobFormMessage').textContent = '';
}

function editJob(job) {
  const form = document.getElementById('jobForm');
  for (const key of ['id', 'title', 'description', 'category', 'location', 'modality', 'salary_min', 'salary_max', 'minimum_experience', 'contract_type', 'work_schedule', 'openings', 'closing_date', 'status']) {
    form.elements[key].value = job[key] ?? '';
  }
  document.getElementById('jobFormHeading').textContent = 'Editar vacante';
  document.getElementById('saveJob').textContent = 'Guardar cambios';
  document.getElementById('cancelEdit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitJob(form) {
  if (!form.reportValidity()) return;
  const button = document.getElementById('saveJob'); const original = button.textContent;
  const jobId = form.elements.id.value;
  const payload = Object.fromEntries(new FormData(form).entries()); delete payload.id;
  for (const key of ['salary_min', 'salary_max']) payload[key] = payload[key] === '' ? null : Number(payload[key]);
  payload.openings = Number(payload.openings); payload.closing_date = payload.closing_date || null;
  button.disabled = true; button.textContent = jobId ? 'Guardando…' : 'Publicando…';
  try {
    await apiRequest(jobId ? `/api/jobs/${jobId}` : '/api/jobs', { method: jobId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    resetJobForm(); document.getElementById('jobFormMessage').textContent = jobId ? 'Vacante actualizada.' : 'Vacante publicada.';
    await loadJobs();
  } catch (error) { document.getElementById('jobFormMessage').textContent = error.message; }
  finally { button.disabled = false; button.textContent = original; }
}

async function initDashboard() {
  const loader = document.getElementById('pageLoader');
  const loaderText = loader?.querySelector('.loader-text');
  document.documentElement.classList.add('is-loading');
  try {
    const data = await apiRequest('/api/auth/me'); currentUser = data.user;
    document.body.classList.add('is-authenticated');
    document.getElementById('greetName').textContent = currentUser.name;
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userInitial').textContent = currentUser.name.trim().charAt(0).toUpperCase();
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('accountType').textContent = currentUser.type === 'empresa' ? 'Empresa' : 'Candidato';
    const isCompany = currentUser.type === 'empresa';
    document.getElementById('roleDescription').textContent = isCompany ? 'Administra las vacantes de tu empresa.' : 'Explora las oportunidades laborales disponibles.';
    document.getElementById('companyTools').hidden = !isCompany;
    document.getElementById('jobsHeading').textContent = isCompany ? 'Mis vacantes' : 'Vacantes activas';
    const form = document.getElementById('jobForm');
    form?.addEventListener('submit', (event) => { event.preventDefault(); submitJob(form); });
    document.getElementById('cancelEdit')?.addEventListener('click', resetJobForm);
    document.getElementById('searchJobs')?.addEventListener('click', loadJobs);
    document.getElementById('jobSearch')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); loadJobs(); } });
    document.getElementById('jobsList')?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]'); if (!button) return;
      const job = currentJobs.find((item) => String(item.id) === button.dataset.jobId);
      if (button.dataset.action === 'edit' && job) return editJob(job);
      if (button.dataset.action === 'delete' && window.confirm('¿Eliminar esta vacante? Esta acción no se puede deshacer.')) {
        button.disabled = true;
        try { await apiRequest(`/api/jobs/${button.dataset.jobId}`, { method: 'DELETE' }); await loadJobs(); }
        catch (error) { document.getElementById('jobsMessage').textContent = error.message; button.disabled = false; }
      }
    });
    await loadJobs();
    document.documentElement.classList.remove('is-loading'); loader?.classList.add('is-hidden');
  } catch (error) {
    if (error.status === 401) return window.location.replace('./login.html');
    if (loaderText) loaderText.textContent = `${error.message} Recarga después de iniciar el backend.`;
    document.documentElement.classList.add('is-loading'); loader?.classList.remove('is-hidden');
  }
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && document.body.dataset.page === 'dashboard') {
    document.body.classList.remove('is-authenticated');
    initDashboard();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => { event.preventDefault(); submitAuth(loginForm, false); });
  const registerForm = document.getElementById('registerForm');
  registerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!registerForm.elements.consent?.checked) {
      registerForm.querySelector('.consent')?.classList.add('is-invalid');
      setNotice(registerForm, 'Acepta la política de tratamiento de datos para crear tu cuenta.');
      return;
    }
    submitAuth(registerForm, true);
  });
  if (document.body.dataset.page === 'dashboard') initDashboard();
  document.querySelector('.dash-logout')?.addEventListener('click', async (event) => {
    event.preventDefault();
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); window.location.replace('./login.html'); }
    catch (error) { window.alert(error.message); }
  });
});
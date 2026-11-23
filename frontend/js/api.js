// Cliente HTTP compartido por todas las paginas.
// - Con Live Server (puerto 5500) la API esta en el puerto 3000 del mismo host.
// - Cuando Express sirve el frontend (local en :3000 o en produccion) la API esta en el mismo origen.
const API_URL = window.NOVA_API_URL
  ?? (window.location.port === '5500' ? `${window.location.protocol}//${window.location.hostname}:3000` : '');

async function apiRequest(path, options = {}) {
  const isForm = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      // Con FormData el navegador pone el Content-Type multipart y su boundary: no se fija a mano.
      headers: { ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch (_error) {
    throw new Error('No se pudo conectar con NOVA. Comprueba tu conexión o que el backend esté iniciado.');
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Ocurrió un error. Intenta nuevamente.');
    error.status = response.status;
    throw error;
  }
  return body;
}

// URL absoluta para <img src> y enlaces de descarga devueltos por la API (/api/files/:id/download).
function fileUrl(path) {
  return path ? `${API_URL}${path}` : '';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

// Crea un elemento con clase y texto (textContent: nunca innerHTML con datos del usuario).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const MAX_UPLOAD_MB = 5;
// Validacion previa en el navegador; el servidor vuelve a validar el contenido real del archivo.
function checkFile(file, { accept, label }) {
  if (!file) return `Selecciona ${label}.`;
  if (!accept.includes(file.type)) return `${label[0].toUpperCase()}${label.slice(1)} debe ser ${accept.includes('application/pdf') ? 'un PDF' : 'una imagen PNG, JPG o WEBP'}.`;
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `El archivo pesa ${formatBytes(file.size)}; el máximo es ${MAX_UPLOAD_MB} MB.`;
  return '';
}

const APPLICATION_STATUS = {
  sent: 'Enviada', in_review: 'En revisión', rejected: 'No seleccionada', accepted: 'Aceptada',
};

// Rutas privadas: valida la sesion contra la API antes de mostrar la pagina.
// Si no hay sesion (401) redirige al login, tambien al volver con el boton "atras".
async function requireSession() {
  const data = await apiRequest('/api/auth/me');
  document.body.classList.add('is-authenticated');
  return data.user;
}

function showFatal(message) {
  const loader = document.getElementById('pageLoader');
  document.documentElement.classList.add('is-loading');
  if (loader) {
    loader.classList.remove('is-hidden', 'is-exiting');
    loader.style.display = '';
    let text = loader.querySelector('.loader-text');
    if (!text) { text = el('p', 'loader-text'); loader.append(text); }
    text.textContent = message;
  }
}

async function guardPrivatePage(init) {
  try {
    const user = await requireSession();
    await init(user);
  } catch (error) {
    if (error.status === 401) return window.location.replace('./login.html');
    showFatal(`${error.message} Recarga la página para intentarlo de nuevo.`);
  }
}

function bindLogout() {
  document.querySelectorAll('.dash-logout').forEach((link) => link.addEventListener('click', async (event) => {
    event.preventDefault();
    link.setAttribute('aria-busy', 'true');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (_error) {
      // Aunque falle la red, se sale del panel; la cookie expira sola.
    }
    window.location.replace('./login.html');
  }));
}

// Al volver con "atras" a una pagina privada guardada en cache, se vuelve a validar la sesion.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && document.body.classList.contains('dashboard-page')) {
    apiRequest('/api/auth/me').catch((error) => { if (error.status === 401) window.location.replace('./login.html'); });
  }
});

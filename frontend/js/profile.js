// Pagina privada de perfil: datos de la cuenta, foto o logo, hoja de vida y archivos guardados.
// Requiere api.js.

const byId = (id) => document.getElementById(id);
const profileState = { user: null, data: null };
const KIND_LABEL = { cv: 'Hoja de vida', logo: 'Logo', foto_perfil: 'Foto de perfil' };
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function setMessage(id, text, success = false) {
  const node = byId(id);
  node.textContent = text;
  node.classList.toggle('success', success);
}

function paintAvatar(container, avatar, name) {
  if (avatar) {
    const img = el('img');
    img.src = fileUrl(avatar.url);
    img.alt = profileState.user.type === 'empresa' ? 'Logo de la empresa' : 'Foto de perfil';
    container.replaceChildren(img);
  } else {
    container.textContent = (name || 'U').trim().charAt(0).toUpperCase();
  }
}

function render(data) {
  profileState.data = data;
  const { user, profile } = data;
  const form = byId('profileForm');
  form.elements.name.value = user.name || '';
  form.elements.email.value = user.email;
  form.elements.phone.value = user.phone || '';
  for (const [key, value] of Object.entries(profile)) {
    if (form.elements[key]) form.elements[key].value = value ?? '';
  }
  byId('sideName').textContent = user.name;
  byId('sideEmail').textContent = user.email;
  paintAvatar(byId('avatarPreview'), data.avatar, user.name);
  paintAvatar(byId('sideAvatar'), data.avatar, user.name);

  if (user.type === 'candidato') {
    const current = byId('cvCurrent');
    if (data.cv) {
      const link = el('a', 'file-chip', `${data.cv.original_name} · ${formatBytes(data.cv.size_bytes)}`);
      link.href = fileUrl(data.cv.url);
      link.target = '_blank';
      link.rel = 'noopener';
      current.replaceChildren(el('span', null, 'Guardada:'), link, el('span', null, `subida el ${formatDate(data.cv.uploaded_at)}`));
    } else {
      current.replaceChildren(el('span', null, 'Aún no has guardado una hoja de vida.'));
    }
  }
}

function renderFiles(files) {
  const list = byId('filesList');
  list.replaceChildren(...files.map((file) => {
    const item = el('li', 'app-item');
    const head = el('div', 'app-head');
    const who = el('div', 'app-who');
    who.append(el('strong', null, file.original_name), el('span', null, `${KIND_LABEL[file.kind] || file.kind} · ${formatBytes(file.size_bytes)} · ${formatDate(file.uploaded_at)}`));
    head.append(who);
    const foot = el('div', 'app-foot');
    const view = el('a', 'file-chip', 'Ver');
    view.href = fileUrl(file.url);
    view.target = '_blank';
    view.rel = 'noopener';
    foot.append(view);
    if (file.used_in_applications > 0) {
      foot.append(el('span', 'app-date', `Adjunta a ${file.used_in_applications} postulación${file.used_in_applications === 1 ? '' : 'es'}`));
    } else {
      const remove = el('button', 'btn btn-outline btn-danger', 'Borrar');
      remove.type = 'button';
      remove.dataset.id = String(file.id);
      foot.append(remove);
    }
    item.append(head, foot);
    return item;
  }));
  byId('filesMessage').textContent = files.length ? '' : 'Todavía no has subido archivos.';
}

async function loadFiles() {
  byId('filesMessage').textContent = 'Cargando archivos…';
  try {
    const data = await apiRequest('/api/files/mine');
    renderFiles(data.files);
  } catch (error) {
    byId('filesMessage').textContent = error.message;
  }
}

async function reloadProfile() {
  render(await apiRequest('/api/profile'));
}

async function uploadFile({ input, button, messageId, kind, accept, label }) {
  const file = input.files[0];
  const problem = checkFile(file, { accept, label });
  if (problem) return setMessage(messageId, problem);
  const data = new FormData();
  data.append('tipo', kind); // texto antes que el archivo
  data.append('archivo', file);
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Subiendo…';
  setMessage(messageId, '');
  try {
    await apiRequest('/api/files', { method: 'POST', body: data });
    input.value = '';
    setMessage(messageId, 'Archivo guardado.', true);
    await Promise.all([reloadProfile(), loadFiles()]);
  } catch (error) {
    setMessage(messageId, error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = byId('profileForm');
  if (!form.reportValidity()) return;
  const payload = { name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim() };
  form.querySelectorAll(`[data-role="${profileState.user.type}"] [name]`).forEach((input) => { payload[input.name] = input.value.trim(); });
  const button = byId('profileSubmit');
  button.disabled = true;
  button.textContent = 'Guardando…';
  setMessage('profileMessage', '');
  try {
    render(await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(payload) }));
    setMessage('profileMessage', 'Perfil actualizado.', true);
  } catch (error) {
    setMessage('profileMessage', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar cambios';
  }
}

async function initProfile(user) {
  profileState.user = user;
  const company = user.type === 'empresa';
  // Muestra solo los campos del rol y quita los del otro rol para que no se validen ni se envien.
  document.querySelectorAll('[data-role]').forEach((node) => { if (node.dataset.role !== user.type) node.remove(); });
  byId('navApplications').hidden = company;
  byId('cvCard').hidden = company;
  byId('profileHeading').textContent = company ? 'Perfil de la empresa' : 'Perfil profesional';
  byId('avatarHeading').textContent = company ? 'Logo de la empresa' : 'Foto de perfil';
  byId('avatarHint').textContent = company
    ? 'Aparece en tus vacantes. PNG, JPG o WEBP de máximo 5 MB.'
    : 'La ven las empresas a las que te postulas. PNG, JPG o WEBP de máximo 5 MB.';
  byId('dataHint').textContent = company ? 'Los candidatos ven el nombre de la empresa en tus vacantes.' : 'Esta información la ven las empresas cuando te postulas.';
  if (company) byId('avatarPreview').classList.add('is-logo');
  if (company) byId('profileForm').elements.company_name.required = true;

  byId('profileForm').addEventListener('submit', saveProfile);
  byId('avatarForm').addEventListener('submit', (event) => {
    event.preventDefault();
    uploadFile({ input: byId('avatarFile'), button: byId('avatarSubmit'), messageId: 'avatarMessage', kind: company ? 'logo' : 'foto_perfil', accept: IMAGE_TYPES, label: 'la imagen' });
  });
  byId('cvForm').addEventListener('submit', (event) => {
    event.preventDefault();
    uploadFile({ input: byId('cvFile'), button: byId('cvSubmit'), messageId: 'cvMessage', kind: 'cv', accept: ['application/pdf'], label: 'la hoja de vida' });
  });
  byId('filesList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button || !window.confirm('¿Borrar este archivo? Se eliminará del almacenamiento y de tu perfil.')) return;
    button.disabled = true;
    try {
      await apiRequest(`/api/files/${button.dataset.id}`, { method: 'DELETE' });
      await Promise.all([reloadProfile(), loadFiles()]);
    } catch (error) {
      byId('filesMessage').textContent = error.message;
      button.disabled = false;
    }
  });
  bindLogout();

  await Promise.all([reloadProfile(), loadFiles()]);
  document.documentElement.classList.remove('is-loading');
  byId('pageLoader')?.classList.add('is-hidden');
}

document.addEventListener('DOMContentLoaded', () => guardPrivatePage(initProfile));

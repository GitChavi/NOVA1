// Login y registro (paginas publicas). Requiere api.js.

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
    setNotice(form, 'La contraseña requiere mínimo 6 caracteres, una mayúscula y un número.');
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  const label = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = isRegister ? 'Creando cuenta…' : 'Iniciando sesión…'; }
  setNotice(form, '');
  const payload = { email: form.elements.email.value.trim(), password };
  if (isRegister) {
    payload.name = form.elements.name.value.trim();
    payload.type = form.elements.role.value;
  }
  try {
    await apiRequest(`/api/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(payload) });
    setNotice(form, isRegister ? 'Cuenta creada. Abriendo tu espacio…' : 'Inicio correcto. Abriendo tu espacio…', true);
    document.getElementById(isRegister ? 'registerOverlay' : 'successOverlay')?.classList.add('is-active');
    window.setTimeout(() => window.location.replace('./dashboard.html'), 500);
  } catch (error) {
    setNotice(form, error.message);
    if (submit) { submit.disabled = false; submit.textContent = label; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Quien ya tiene sesion no necesita volver a iniciarla: va directo a su panel.
  apiRequest('/api/auth/me').then(() => window.location.replace('./dashboard.html')).catch(() => {});

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
});

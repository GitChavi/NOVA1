const transition = document.getElementById('pageTransition');
const loader = document.getElementById('pageLoader');
window.addEventListener('load', () => { if (loader) window.setTimeout(() => loader.classList.add('is-hidden'), 500); });

document.querySelectorAll('a[data-transition]').forEach((link) => link.addEventListener('click', (event) => {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || link.target === '_blank') return;
  event.preventDefault();
  transition?.classList.add('is-active');
  window.setTimeout(() => { window.location.href = href; }, 250);
}));

const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle && mainNav) menuToggle.addEventListener('click', () => {
  const opened = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(opened));
});

const roleButtons = document.querySelectorAll('.role-option');
const roleInput = document.getElementById('role');
roleButtons.forEach((button) => button.addEventListener('click', () => {
  roleButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  if (roleInput) roleInput.value = button.dataset.role;
}));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function showMessage(form, text, success = false) {
  const message = form.querySelector('.form-message');
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('success', success);
}
function passwordValid(value) { return value.length >= 6 && /[A-Z]/.test(value) && /[0-9]/.test(value); }

const loginForm = document.getElementById('loginForm');
loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  if (!emailPattern.test(email) || password.length < 6) return showMessage(loginForm, 'Revisa el correo y la contraseña.');
  showMessage(loginForm, 'Datos válidos. El acceso todavía no está conectado al backend.', true);
});

const registerForm = document.getElementById('registerForm');
registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!registerForm.reportValidity()) return;
  const name = registerForm.elements.name.value.trim();
  const email = registerForm.elements.email.value.trim();
  const password = registerForm.elements.password.value;
  if (name.length < 2 || !emailPattern.test(email) || !passwordValid(password)) return showMessage(registerForm, 'Revisa tus datos y los requisitos de contraseña.');
  const role = roleInput?.value === 'empresa' ? 'empresa' : 'candidato';
  showMessage(registerForm, `Datos válidos para el registro de ${role}. La autenticación todavía no está conectada al backend.`, true);
});

const userName = document.getElementById('userName');
if (userName) userName.textContent = sessionStorage.getItem('novaName') || 'Usuario';
document.querySelector('.dash-logout')?.addEventListener('click', () => sessionStorage.removeItem('novaName'));

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); currentObserver.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealElements.forEach((element) => observer.observe(element));
} else revealElements.forEach((element) => element.classList.add('is-visible'));

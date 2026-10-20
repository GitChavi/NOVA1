const transition = document.getElementById('pageTransition');
const loader = document.getElementById('pageLoader');
const seen = sessionStorage.getItem('novaSeen');
if (loader && seen) { loader.style.transition = 'none'; loader.classList.add('is-hidden'); }
window.addEventListener('load', () => {
  sessionStorage.setItem('novaSeen', '1');
  if (loader && !seen) window.setTimeout(() => loader.classList.add('is-hidden'), 600);
});

// Navegadores con View Transitions entre páginas las manejan solos (ver CSS); el resto usa la cortina circular.
const nativeTransitions = 'onpagereveal' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('a[data-transition]').forEach((link) => link.addEventListener('click', (event) => {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || link.target === '_blank' || event.metaKey || event.ctrlKey || nativeTransitions) return;
  event.preventDefault();
  if (transition) {
    transition.style.setProperty('--cx', `${event.clientX}px`);
    transition.style.setProperty('--cy', `${event.clientY}px`);
    transition.classList.add('is-active');
  }
  window.setTimeout(() => { window.location.href = href; }, 420);
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
  sessionStorage.setItem('novaName', email.split('@')[0]);
  document.getElementById('successOverlay')?.classList.add('is-active');
  window.setTimeout(() => { window.location.href = './dashboard.html'; }, 1200);
});

const registerForm = document.getElementById('registerForm');
registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const consent = registerForm.elements.consent;
  if (consent && !consent.checked) {
    consent.closest('.consent')?.classList.add('is-invalid');
    return showMessage(registerForm, 'Acepta la política de tratamiento de datos para crear tu cuenta.');
  }
  if (!registerForm.reportValidity()) return;
  const name = registerForm.elements.name.value.trim();
  const email = registerForm.elements.email.value.trim();
  const password = registerForm.elements.password.value;
  if (name.length < 2 || !emailPattern.test(email) || !passwordValid(password)) return showMessage(registerForm, 'Revisa tus datos y los requisitos de contraseña.');
  const role = roleInput?.value === 'empresa' ? 'empresa' : 'candidato';
  sessionStorage.setItem('novaName', name);
  sessionStorage.setItem('novaConsent', new Date().toISOString());
  document.getElementById('registerOverlay')?.classList.add('is-active');
  window.setTimeout(() => { window.location.href = './login.html'; }, 1200);
});

const userName = document.getElementById('userName');
if (userName) {
  const name = sessionStorage.getItem('novaName') || 'Usuario';
  userName.textContent = name;
  const greet = document.getElementById('greetName');
  if (greet) greet.textContent = name;
  const initial = document.getElementById('userInitial');
  if (initial) initial.textContent = name.charAt(0).toUpperCase();
}
document.querySelector('.dash-logout')?.addEventListener('click', () => sessionStorage.removeItem('novaName'));

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); currentObserver.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealElements.forEach((element) => observer.observe(element));
} else revealElements.forEach((element) => element.classList.add('is-visible'));

// Política de datos (modal) y consentimiento
const policyDialog = document.getElementById('policyDialog');
const consentBox = document.getElementById('consent');
document.getElementById('openPolicy')?.addEventListener('click', (e) => { e.preventDefault(); policyDialog?.showModal(); });
policyDialog?.addEventListener('click', (e) => { if (e.target === policyDialog || e.target.closest('[data-close]')) policyDialog.close(); });
document.getElementById('acceptPolicy')?.addEventListener('click', () => {
  if (consentBox) { consentBox.checked = true; consentBox.closest('.consent')?.classList.remove('is-invalid'); }
  policyDialog.close();
});
consentBox?.addEventListener('change', () => { if (consentBox.checked) consentBox.closest('.consent')?.classList.remove('is-invalid'); });

// Barra que se compacta y palabra de fondo con paralaje
const navbar = document.querySelector('.navbar:not(.compact)');
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--sy', window.scrollY);
    navbar?.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  });
}, { passive: true });

// Paralaje suave de las vacantes del hero según el cursor
const heroStage = document.querySelector('.hero-visual');
if (heroStage && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  heroStage.addEventListener('pointermove', (e) => {
    const r = heroStage.getBoundingClientRect();
    heroStage.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    heroStage.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  heroStage.addEventListener('pointerleave', () => { heroStage.style.setProperty('--px', 0); heroStage.style.setProperty('--py', 0); });
}
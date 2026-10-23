// ===== Utilidades =====
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
const rootEl = document.documentElement;
const page = document.body.dataset.page;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const transition = document.getElementById('pageTransition');
const loader = document.getElementById('pageLoader');

// Protege el panel: sin sesión no se muestra (también al volver con el botón "atrás")
function guardDashboard() {
  if (page === 'dashboard' && !ss.get('novaSession')) { window.location.replace('./login.html'); return true; }
  return false;
}
guardDashboard();

// Al volver con "atrás" el navegador restaura la página tal cual estaba (bfcache):
// quitamos la cortina y los avisos que hubieran quedado abiertos.
function resetOverlays() {
  if (transition) {
    transition.style.transition = 'none';
    transition.classList.remove('is-active');
    void transition.offsetWidth;
    transition.style.transition = '';
  }
  document.querySelectorAll('.success-overlay.is-active').forEach((el) => el.classList.remove('is-active'));
}
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  resetOverlays();
  guardDashboard();
});

// ===== Intro de marca (solo la primera vez de la sesión) =====
if (loader && ss.get('novaSeen')) {
  loader.style.display = 'none';
  rootEl.classList.remove('is-loading');
} else if (loader) {
  const MIN = reduceMotion ? 250 : 1700;
  const t0 = performance.now();
  let loaded = document.readyState === 'complete';
  let finished = false;
  window.addEventListener('load', () => { loaded = true; });
  const finish = () => {
    if (finished) return; finished = true;
    ss.set('novaSeen', '1');
    loader.classList.add('is-exiting');
    window.setTimeout(() => rootEl.classList.remove('is-loading'), reduceMotion ? 0 : 260);
    window.setTimeout(() => loader.classList.add('is-hidden'), reduceMotion ? 50 : 1000);
  };
  const wait = (now) => {
    if (finished) return;
    if (loaded && now - t0 >= MIN) { finish(); return; }
    requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
  window.setTimeout(finish, 6000);
}

// ===== Transición entre páginas =====
// Los navegadores con View Transitions la manejan solos (ver CSS); el resto usa la cortina circular.
const nativeTransitions = 'onpagereveal' in window && !reduceMotion;
document.querySelectorAll('a[data-transition]').forEach((link) => link.addEventListener('click', (event) => {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || link.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  const url = new URL(link.href, window.location.href);
  if (url.pathname === window.location.pathname && !url.hash) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }
  if (nativeTransitions) return;
  event.preventDefault();
  if (transition) {
    transition.style.setProperty('--cx', `${event.clientX}px`);
    transition.style.setProperty('--cy', `${event.clientY}px`);
    transition.classList.add('is-active');
  }
  window.setTimeout(() => { window.location.href = href; }, 420);
}));

// ===== Menú móvil =====
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const opened = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(opened));
  });
  mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
}

// ===== Selector de rol =====
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

// ===== Formularios =====
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
  if (loginForm.dataset.busy) return;
  if (!loginForm.reportValidity()) return;
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  if (!emailPattern.test(email) || password.length < 6) return showMessage(loginForm, 'Revisa el correo y la contraseña.');
  loginForm.dataset.busy = '1';
  if (!ss.get('novaName')) ss.set('novaName', email.split('@')[0]);
  ss.set('novaSession', '1');
  document.getElementById('successOverlay')?.classList.add('is-active');
  window.setTimeout(() => { window.location.replace('./dashboard.html'); }, 1200);
});

const registerForm = document.getElementById('registerForm');
registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (registerForm.dataset.busy) return;
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
  registerForm.dataset.busy = '1';
  ss.set('novaName', name);
  ss.set('novaConsent', new Date().toISOString());
  document.getElementById('registerOverlay')?.classList.add('is-active');
  window.setTimeout(() => { window.location.replace('./login.html'); }, 1200);
});

// ===== Panel =====
const userName = document.getElementById('userName');
if (userName) {
  const name = ss.get('novaName') || 'Usuario';
  userName.textContent = name;
  const greet = document.getElementById('greetName');
  if (greet) greet.textContent = name;
  const initial = document.getElementById('userInitial');
  if (initial) initial.textContent = name.charAt(0).toUpperCase();
}
document.querySelector('.dash-logout')?.addEventListener('click', () => { ss.del('novaSession'); ss.del('novaName'); });

// ===== Aparición al hacer scroll =====
const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); currentObserver.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealElements.forEach((element) => observer.observe(element));
} else revealElements.forEach((element) => element.classList.add('is-visible'));

// ===== Política de datos (modal) y consentimiento =====
const policyDialog = document.getElementById('policyDialog');
const consentBox = document.getElementById('consent');
document.getElementById('openPolicy')?.addEventListener('click', (e) => { e.preventDefault(); policyDialog?.showModal(); });
policyDialog?.addEventListener('click', (e) => { if (e.target === policyDialog || e.target.closest('[data-close]')) policyDialog.close(); });
document.getElementById('acceptPolicy')?.addEventListener('click', () => {
  if (consentBox) { consentBox.checked = true; consentBox.closest('.consent')?.classList.remove('is-invalid'); }
  policyDialog?.close();
});
consentBox?.addEventListener('change', () => { if (consentBox.checked) consentBox.closest('.consent')?.classList.remove('is-invalid'); });

// ===== Barra que se compacta y paralaje =====
const navbar = document.querySelector('.navbar:not(.compact)');
const heroVis = document.querySelector('.hero-visual');
let ticking = false;
const revealNow = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('is-visible'); });
revealNow();
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    if (heroVis && window.scrollY < 1400) heroVis.style.setProperty('--sy', window.scrollY);
    navbar?.classList.toggle('is-scrolled', window.scrollY > 24);
    revealNow();
    ticking = false;
  });
}, { passive: true });
navbar?.classList.toggle('is-scrolled', window.scrollY > 24);

// ===== Paralaje suave de las vacantes del hero según el cursor =====
const heroStage = document.querySelector('.hero-visual');
if (heroStage && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  heroStage.addEventListener('pointermove', (e) => {
    const r = heroStage.getBoundingClientRect();
    heroStage.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    heroStage.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  heroStage.addEventListener('pointerleave', () => { heroStage.style.setProperty('--px', 0); heroStage.style.setProperty('--py', 0); });
}

// ===== Titular palabra por palabra y contadores del panel =====
(() => {
  if (reduceMotion) return;
  const title = document.querySelector('.hero h1, .auth-side h1');
  if (title) {
    title.setAttribute('aria-label', title.textContent.trim());
    let n = 0;
    const walk = (node) => [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i'); i.style.setProperty('--i', n++); i.textContent = part;
          w.append(i); frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
    walk(title); title.classList.add('is-split');
  }
  document.querySelectorAll('.dash-stats strong').forEach((el, i) => {
    const to = parseInt(el.textContent, 10); if (Number.isNaN(to)) return;
    const start = performance.now() + 300 + i * 90; el.textContent = '0';
    const tick = (t) => { const p = Math.min(Math.max((t - start) / 1000, 0), 1); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
})();

// ===== Brillo que sigue al cursor sobre las superficies de vidrio =====
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.metrics, .feature-card, .step-list li').forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
}
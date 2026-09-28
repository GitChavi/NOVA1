document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const name = form.elements.name?.value.trim();
      if (name) sessionStorage.setItem('novaName', name);
      const notice = form.querySelector('.notice');
      if (notice) notice.textContent = 'Formulario validado. La autenticación se conectará en un siguiente avance.';
    });
  });
  document.querySelector('[data-logout]')?.addEventListener('click', () => {
    sessionStorage.removeItem('novaName');
    window.location.href = './index.html';
  });
});

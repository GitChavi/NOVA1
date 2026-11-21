// Opciones de la cookie de sesion compartidas por login, logout y el middleware de auth.
const cookieName = 'nova_session';
const sessionMs = 8 * 60 * 60 * 1000;

function cookieOptions({ withMaxAge = true } = {}) {
  // Con frontend y API en dominios distintos hace falta SameSite=None (y por tanto Secure).
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const options = {
    httpOnly: true,
    secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
    sameSite,
    path: '/',
  };
  if (withMaxAge) options.maxAge = sessionMs;
  return options;
}

module.exports = { cookieName, sessionMs, cookieOptions };

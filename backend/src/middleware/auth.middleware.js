const jwt = require('jsonwebtoken');
const { cookieName, cookieOptions } = require('../config/session');

function readSession(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Rutas privadas: sin cookie valida responde 401 y el frontend redirige al login.
function requireAuth(req, res, next) {
  try {
    req.auth = readSession(req);
  } catch (_error) {
    res.clearCookie(cookieName, cookieOptions({ withMaxAge: false }));
    return res.status(401).json({ error: 'La sesion vencio. Inicia sesion nuevamente.' });
  }
  if (!req.auth) return res.status(401).json({ error: 'Debes iniciar sesion para continuar.' });
  return next();
}

// Rutas publicas que muestran mas datos si hay sesion (por ejemplo, descargar un archivo).
function optionalAuth(req, _res, next) {
  try {
    req.auth = readSession(req);
  } catch (_error) {
    req.auth = null;
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;

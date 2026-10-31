const jwt = require('jsonwebtoken');

function clearSessionCookie(res) {
  res.clearCookie('nova_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.nova_session;
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesion para continuar.' });

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'La sesion vencio. Inicia sesion nuevamente.' });
  }
}

module.exports = requireAuth;
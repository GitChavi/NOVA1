const db = require('../db');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const result = await db.query('SELECT tipo FROM usuarios WHERE id = $1', [req.auth.sub]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'La cuenta ya no existe.' });
      if (!allowedRoles.includes(user.tipo)) {
        return res.status(403).json({ error: 'No tienes permiso para realizar esta accion.' });
      }
      req.auth.userType = user.tipo;
      return next();
    } catch (error) {
      console.error('Role lookup error:', error.message);
      return res.status(500).json({ error: 'No se pudo validar el permiso.' });
    }
  };
}

module.exports = requireRole;
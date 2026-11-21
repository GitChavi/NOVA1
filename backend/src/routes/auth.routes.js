const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAuth = require('../middleware/auth.middleware');
const auth = require('../controllers/auth.controller');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();

// Frena ataques de fuerza bruta sobre login y registro.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

router.post('/register', authLimiter, asyncHandler(auth.register));
router.post('/login', authLimiter, asyncHandler(auth.login));
router.post('/logout', auth.logout);
router.get('/me', requireAuth, asyncHandler(auth.me));

module.exports = router;

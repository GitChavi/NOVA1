const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const profile = require('../controllers/profile.controller');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(profile.get));
router.put('/', requireAuth, asyncHandler(profile.update));

module.exports = router;

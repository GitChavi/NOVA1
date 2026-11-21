const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole.middleware');
const { singleFile } = require('../middleware/upload.middleware');
const files = require('../controllers/files.controller');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();

router.post('/', requireAuth, requireRole('candidato', 'empresa'), singleFile, asyncHandler(files.uploadProfileFile));
router.get('/mine', requireAuth, asyncHandler(files.listMine));
router.get('/:id/download', optionalAuth, asyncHandler(files.download));
router.delete('/:id', requireAuth, asyncHandler(files.remove));

module.exports = router;

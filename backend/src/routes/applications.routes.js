const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole.middleware');
const { singleFile } = require('../middleware/upload.middleware');
const applications = require('../controllers/applications.controller');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();
const candidateOnly = [requireAuth, requireRole('candidato')];
const companyOnly = [requireAuth, requireRole('empresa')];

router.post('/', ...candidateOnly, singleFile, asyncHandler(applications.create));
router.get('/mine', ...candidateOnly, asyncHandler(applications.listMine));
router.delete('/:id', ...candidateOnly, asyncHandler(applications.withdraw));
router.patch('/:id/status', ...companyOnly, asyncHandler(applications.updateStatus));

module.exports = router;

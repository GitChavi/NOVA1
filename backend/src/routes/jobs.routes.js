const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole.middleware');
const jobs = require('../controllers/jobs.controller');

const router = express.Router();
const companyOnly = [requireAuth, requireRole('empresa')];

router.get('/', jobs.listActive);
router.get('/mine', ...companyOnly, jobs.listMine);
router.get('/:id', jobs.getOne);
router.post('/', ...companyOnly, jobs.create);
router.put('/:id', ...companyOnly, jobs.update);
router.delete('/:id', ...companyOnly, jobs.remove);

module.exports = router;
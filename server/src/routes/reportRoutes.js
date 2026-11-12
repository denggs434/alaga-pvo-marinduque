const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, adminOnly, ownerOnly } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const reportLimit = rateLimit({ windowMs: 60 * 60e3, max: 10, message: 'You have filed many reports this hour. For emergencies, call the PVO hotline.' });

router.get('/alerts', c.publicAlerts); // public, before /:id
router.get('/mine', protect, c.myReports);
router.route('/').post(protect, ownerOnly, reportLimit, c.createReport).get(protect, adminOnly, c.listReports);
router.route('/:id').get(protect, c.getReport).patch(protect, adminOnly, c.updateReport);
router.patch('/:id/withdraw', protect, c.withdrawReport);

module.exports = router;

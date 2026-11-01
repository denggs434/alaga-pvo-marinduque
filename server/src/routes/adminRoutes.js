const router = require('express').Router();
const { getStats, getSales } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/stats', protect, adminOnly, getStats);
router.get('/sales', protect, adminOnly, getSales);

module.exports = router;

const router = require('express').Router();
const c = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Each question costs a model call: keep it to a steady conversation pace.
const chatLimit = rateLimit({ windowMs: 10 * 60e3, max: 30, message: 'You have asked Alagai a lot in a short time. Take a short break and try again.' });

router.post('/chat', protect, chatLimit, c.chat);

module.exports = router;

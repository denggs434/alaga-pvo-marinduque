const router = require('express').Router();
const c = require('../controllers/contactController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const contactLimit = rateLimit({ windowMs: 60 * 60e3, max: 5, message: 'You have sent several messages already. We will reply soon.' });
const followLimit = rateLimit({ windowMs: 10 * 60e3, max: 30, message: 'You are sending messages very fast. Wait a moment and try again.' });
const replyLimit = rateLimit({ windowMs: 10 * 60e3, max: 60, message: 'Too many replies at once. Wait a moment and try again.' });

router.route('/').post(contactLimit, optionalAuth, c.createMessage).get(protect, adminOnly, c.listMessages);
router.get('/mine', protect, c.myMessages);
router.get('/mine/unread', protect, c.myUnreadCount);
router.patch('/mine/read', protect, c.markMineRead);
router.post('/:id/replies', protect, adminOnly, replyLimit, c.replyToMessage);
router.post('/:id/followups', protect, followLimit, c.followUp);
router.patch('/:id', protect, adminOnly, c.setArchived);
// No DELETE route: messages are archived, never removed.

module.exports = router;

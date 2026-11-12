const router = require('express').Router();
const c = require('../controllers/contactController');
const { protect, adminOnly } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const contactLimit = rateLimit({ windowMs: 60 * 60e3, max: 5, message: 'You have sent several messages already. We will reply soon.' });

router.route('/').post(contactLimit, c.createMessage).get(protect, adminOnly, c.listMessages);
router.route('/:id').patch(protect, adminOnly, c.updateMessageStatus).delete(protect, adminOnly, c.deleteMessage);

module.exports = router;

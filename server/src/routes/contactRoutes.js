const router = require('express').Router();
const c = require('../controllers/contactController');
const { protect, adminOnly } = require('../middleware/auth');

router.route('/').post(c.createMessage).get(protect, adminOnly, c.listMessages);
router.route('/:id').patch(protect, adminOnly, c.updateMessageStatus).delete(protect, adminOnly, c.deleteMessage);

module.exports = router;

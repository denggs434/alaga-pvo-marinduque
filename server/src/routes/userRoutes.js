const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// 10 login/registration attempts per 15 minutes per IP slows password guessing.
const authLimit = rateLimit({ windowMs: 15 * 60e3, max: 10, message: 'Too many attempts. Wait 15 minutes and try again.' });

router.post('/register', authLimit, c.register);
router.post('/login', authLimit, c.login);
router.route('/me').get(protect, c.getMe).put(protect, c.updateMe);
router.get('/', protect, adminOnly, c.listUsers);
router.patch('/:id/ban', protect, adminOnly, c.setBanned);
router.delete('/:id', protect, adminOnly, c.deleteUser);

module.exports = router;

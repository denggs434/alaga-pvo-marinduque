const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.route('/me').get(protect, c.getMe).put(protect, c.updateMe);
router.get('/', protect, adminOnly, c.listUsers);

module.exports = router;

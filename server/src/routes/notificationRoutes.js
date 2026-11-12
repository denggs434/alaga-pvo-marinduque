const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', c.list);
router.get('/unread', c.unread);
router.patch('/read-all', c.readAll);
router.patch('/:id/read', c.readOne);

module.exports = router;

const router = require('express').Router();
const c = require('../controllers/postController');
const { protect, ownerOnly, optionalAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Posting and commenting are limited to keep spam off the wall.
const writeLimit = rateLimit({ windowMs: 10 * 60e3, max: 30, message: 'You are posting very quickly. Take a short break and try again.' });

router.route('/').get(optionalAuth, c.listPosts).post(protect, ownerOnly, writeLimit, c.createPost);
router.delete('/:id', protect, c.deletePost);
router.post('/:id/like', protect, c.toggleLike);
router.post('/:id/comments', protect, writeLimit, c.addComment);
router.delete('/:id/comments/:cid', protect, c.deleteComment);

module.exports = router;

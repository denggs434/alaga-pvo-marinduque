const router = require('express').Router();
const c = require('../controllers/announcementController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

router.route('/').get(optionalAuth, c.listAnnouncements).post(protect, adminOnly, c.createAnnouncement);
router
  .route('/:id')
  .get(optionalAuth, c.getAnnouncement)
  .put(protect, adminOnly, c.updateAnnouncement)
  .delete(protect, adminOnly, c.deleteAnnouncement);

module.exports = router;

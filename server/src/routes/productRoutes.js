const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

router.route('/').get(optionalAuth, c.listProducts).post(protect, adminOnly, c.createProduct);
router.get('/:idOrSlug', c.getProduct);
router.patch('/:id/stock', protect, adminOnly, c.adjustStock);
router.route('/:id').put(protect, adminOnly, c.updateProduct).delete(protect, adminOnly, c.deleteProduct);

module.exports = router;

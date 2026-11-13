const router = require('express').Router();
const c = require('../controllers/shopController');
const { protect, adminOnly, ownerOnly, optionalAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const orderLimit = rateLimit({ windowMs: 60 * 60e3, max: 15, message: 'You have placed many orders this hour. Please wait a little and try again.' });

router.get('/picks', protect, c.picks);
router.get('/shops', c.listShops);
router.get('/sellers', protect, adminOnly, c.listSellers);
router.patch('/sellers/:id', protect, adminOnly, c.decideSeller);
router.route('/mine').get(protect, ownerOnly, c.myShop).put(protect, ownerOnly, c.updateMyShop);
const listLimit = rateLimit({ windowMs: 60 * 60e3, max: 60, message: 'You have listed many products this hour. Please wait a little.' });

router.route('/products').get(optionalAuth, c.listProducts).post(protect, listLimit, c.createProduct);
router.route('/products/:id').get(optionalAuth, c.getProduct).put(protect, c.updateProduct).delete(protect, c.deleteProduct);

router.get('/orders/mine', protect, c.myOrders);
router.get('/orders/selling', protect, ownerOnly, c.sellingOrders);
router.route('/orders').post(protect, ownerOnly, orderLimit, c.createOrder).get(protect, adminOnly, c.listOrders);
router.patch('/orders/:id/cancel', protect, c.cancelOrder);
router.patch('/orders/:id', protect, c.updateOrder);

module.exports = router;

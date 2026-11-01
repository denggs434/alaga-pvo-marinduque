const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect); // every order route needs a logged-in user

router.route('/').post(c.createOrder).get(adminOnly, c.listOrders);
router.get('/mine', c.myOrders);
router.get('/:id', c.getOrder);
router.patch('/:id/cancel', c.cancelMyOrder);
router.patch('/:id/status', adminOnly, c.updateOrderStatus);

module.exports = router;

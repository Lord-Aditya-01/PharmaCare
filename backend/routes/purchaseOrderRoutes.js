const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getPurchaseOrdersWithSupplier, createPurchaseOrder, getPOById, updatePOStatus, deletePO } = require('../controllers/purchaseOrderController');
const router = express.Router();
router.use(protect);
router.route('/').get(getPurchaseOrdersWithSupplier).post(createPurchaseOrder);
router.route('/:id').get(getPOById).patch(updatePOStatus).delete(deletePO);
module.exports = router;

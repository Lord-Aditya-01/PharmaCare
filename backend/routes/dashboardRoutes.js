const express = require('express');
const {
  getSummary, getLowStock, getExpiringBatches, getAnalytics,
  getInventoryReport, getPurchaseReport,
  exportInventoryReport, exportExpiryReport
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', getSummary);
router.get('/analytics', getAnalytics);
router.get('/low-stock', getLowStock);
router.get('/expiring-batches', getExpiringBatches);
router.get('/reports/inventory', getInventoryReport);
router.get('/reports/purchases', getPurchaseReport);
router.get('/reports/inventory/export', exportInventoryReport);
router.get('/reports/expiry/export', exportExpiryReport);

module.exports = router;

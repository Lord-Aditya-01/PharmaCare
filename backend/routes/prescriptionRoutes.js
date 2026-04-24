const express = require('express');
const {
  getAllPrescriptions,
  getPrescriptionById,
  createPrescription,
  deletePrescription,
  downloadPrescriptionBill,
  getPrescriptionBillPreview
} = require('../controllers/prescriptionController');

const router = express.Router();

router.route('/').get(getAllPrescriptions).post(createPrescription);
router.get('/:id/bill-preview', getPrescriptionBillPreview);
router.get('/:id/bill', downloadPrescriptionBill);
router.route('/:id').get(getPrescriptionById).delete(deletePrescription);

module.exports = router;


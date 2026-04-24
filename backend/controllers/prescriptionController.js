const pool = require('../config/db');
const PDFDocument = require('pdfkit');

const GST_RATE = 0.18;

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

async function loadPrescriptionBillData(prescriptionId) {
  const [prescriptions] = await pool.query(
    `SELECT p.prescription_id, p.date, p.customer_name, p.notes,
            CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
            CONCAT(pt.first_name,' ',pt.last_name) AS patient_name
     FROM prescription p
     JOIN doctor d ON p.doctor_id=d.doctor_id
     LEFT JOIN patient pt ON p.patient_id=pt.patient_id
     WHERE p.prescription_id=?`,
    [prescriptionId]
  );

  if (!prescriptions[0]) {
    return null;
  }

  const [items] = await pool.query(
    `SELECT pr.medicine_id, pr.dosage, pr.quantity,
            m.medicine_name, m.brand_name, m.unit_price
     FROM prescription_medicine pr
     JOIN medicine m ON pr.medicine_id=m.medicine_id
     WHERE pr.prescription_id=?
     ORDER BY pr.medicine_id ASC`,
    [prescriptionId]
  );

  const normalizedItems = items.map((item) => {
    const unitPrice = Number(item.unit_price || 0);
    const quantity = Number(item.quantity || 0);
    return {
      ...item,
      quantity,
      unitPrice,
      lineTotal: Number((unitPrice * quantity).toFixed(2))
    };
  });

  const subtotal = Number(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const taxRate = GST_RATE;
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const grandTotal = Number((subtotal + taxAmount).toFixed(2));

  return {
    prescription: prescriptions[0],
    items: normalizedItems,
    totals: { subtotal, taxRate, taxAmount, grandTotal }
  };
}

async function getAllPrescriptions(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    const where = search
      ? `WHERE (p.customer_name LIKE ? OR CONCAT(d.first_name,' ',d.last_name) LIKE ?
               OR CONCAT(pt.first_name,' ',pt.last_name) LIKE ? OR CAST(p.prescription_id AS CHAR) LIKE ?)`
      : '';
    const params = search ? [`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`] : [];

    const [rows] = await pool.query(
      `SELECT p.prescription_id, p.date, p.customer_name, p.notes,
              CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
              CONCAT(pt.first_name,' ',pt.last_name) AS patient_name
       FROM prescription p
       JOIN doctor d ON p.doctor_id=d.doctor_id
       LEFT JOIN patient pt ON p.patient_id=pt.patient_id
       ${where}
       ORDER BY p.prescription_id DESC`, params
    );
    res.json(rows);
  } catch(e) { next(e); }
}

async function getPrescriptionById(req, res, next) {
  try {
    const [prescriptions] = await pool.query(
      `SELECT p.*, CONCAT(d.first_name,' ',d.last_name) AS doctor_name,
              CONCAT(pt.first_name,' ',pt.last_name) AS patient_name
       FROM prescription p
       JOIN doctor d ON p.doctor_id=d.doctor_id
       LEFT JOIN patient pt ON p.patient_id=pt.patient_id
       WHERE p.prescription_id=?`, [req.params.id]
    );
    if (!prescriptions[0]) { res.status(404); throw new Error('Prescription not found'); }

    const [medicines] = await pool.query(
      `SELECT pr.*, m.medicine_name, m.brand_name
       FROM prescription_medicine pr
       JOIN medicine m ON pr.medicine_id=m.medicine_id
       WHERE pr.prescription_id=?`, [req.params.id]
    );
    res.json({ ...prescriptions[0], medicines });
  } catch(e) { next(e); }
}

async function createPrescription(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { date, customer_name, doctor_id, patient_id, notes, medicines = [] } = req.body;

    if (!date) { res.status(422); throw new Error('date is required'); }
    if (!customer_name || !customer_name.trim()) { res.status(422); throw new Error('customer_name is required'); }
    if (!doctor_id) { res.status(422); throw new Error('doctor_id is required'); }
    if (!medicines.length) { res.status(422); throw new Error('At least one medicine is required'); }

    // Validate date not in future
    const rxDate = new Date(date);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
    if (rxDate > tomorrow) { res.status(422); throw new Error('Prescription date cannot be in the future'); }

    // Validate medicines
    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i];
      if (!m.medicine_id) { res.status(422); throw new Error(`Item ${i+1}: medicine_id is required`); }
      if (!m.dosage || !m.dosage.trim()) { res.status(422); throw new Error(`Item ${i+1}: dosage is required`); }
      const qty = Number(m.quantity);
      if (!Number.isInteger(qty) || qty <= 0) { res.status(422); throw new Error(`Item ${i+1}: quantity must be a positive integer`); }
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO prescription (date, customer_name, doctor_id, patient_id, notes) VALUES (?,?,?,?,?)',
      [date, customer_name.trim(), doctor_id, patient_id || null, notes?.trim() || null]
    );
    const prescriptionId = result.insertId;

    for (const m of medicines) {
      await connection.query(
        'INSERT INTO prescription_medicine (prescription_id, medicine_id, dosage, quantity) VALUES (?,?,?,?)',
        [prescriptionId, m.medicine_id, m.dosage.trim(), Number(m.quantity)]
      );
    }

    await connection.commit();

    // Log activity (non-blocking)
    const medSummary = medicines.map(m => `M${m.medicine_id}x${m.quantity}`).join(', ');
    pool.query(
      `INSERT INTO activity_log (action_type, entity_type, entity_id, description, user_id)
       VALUES ('prescription_created','prescription',?,?,?)`,
      [prescriptionId, `Prescription #${prescriptionId} for ${customer_name.trim()}. Medicines: ${medSummary}`, req.user?.id || null]
    ).catch(() => {});

    res.status(201).json({ prescription_id: prescriptionId, message: 'Prescription created successfully' });
  } catch(e) {
    await connection.rollback();
    next(e);
  } finally { connection.release(); }
}

async function deletePrescription(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM prescription WHERE prescription_id=?', [req.params.id]);
    if (!result.affectedRows) { res.status(404); throw new Error('Prescription not found'); }

    pool.query(
      `INSERT INTO activity_log (action_type, entity_type, entity_id, description, user_id) VALUES ('prescription_deleted','prescription',?,?,?)`,
      [req.params.id, `Prescription #${req.params.id} deleted — stock restored`, req.user?.id || null]
    ).catch(() => {});

    res.json({ message: 'Prescription deleted successfully' });
  } catch(e) { next(e); }
}

async function downloadPrescriptionBill(req, res, next) {
  try {
    const prescriptionId = Number(req.params.id);
    if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
      res.status(400);
      throw new Error('Invalid prescription ID');
    }

    const billData = await loadPrescriptionBillData(prescriptionId);
    if (!billData) {
      res.status(404);
      throw new Error('Prescription not found');
    }

    if (!billData.items.length) {
      res.status(422);
      throw new Error('No prescription medicines found for bill generation');
    }

    const { prescription: rx, items, totals } = billData;
    const amountFormatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const formatAmount = (value) => amountFormatter.format(Number(value || 0));

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const safeDate = toDateOnly(rx.date);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="prescription-bill-${prescriptionId}.pdf"`);

    doc.pipe(res);

    // Header block
    doc.save();
    doc.roundedRect(36, 36, 523, 74, 8).fill('#0f766e');
    doc.restore();
    doc.fillColor('#ffffff').fontSize(19).text('PharmaCare', 52, 52);
    doc.fontSize(11).text('Prescription Bill', 52, 78);
    doc.fontSize(10).text(`Bill No: RX-${prescriptionId}`, 390, 56, { width: 150, align: 'right' });
    doc.text(`Date: ${safeDate}`, 390, 74, { width: 150, align: 'right' });

    // Meta
    doc.fillColor('#111827');
    doc.fontSize(10).text('Customer', 40, 130);
    doc.fontSize(12).text(rx.customer_name || 'Walk-in Customer', 40, 144);
    doc.fontSize(10).text('Prescribed By', 290, 130);
    doc.fontSize(12).text(rx.doctor_name || 'N/A', 290, 144);
    doc.fontSize(10).text('Linked Customer Record', 40, 168);
    doc.fontSize(11).text(rx.patient_name || 'N/A', 40, 182);

    if (rx.notes) {
      doc.fontSize(10).fillColor('#374151').text(`Notes: ${rx.notes}`, 40, 206, { width: 510 });
    }

    doc.moveTo(36, 240).lineTo(559, 240).strokeColor('#cbd5e1').stroke();

    const startX = 40;
    let cursorY = 252;
    const cols = {
      sr: startX,
      medicine: startX + 24,
      dosage: startX + 240,
      qty: startX + 350,
      price: startX + 395,
      total: startX + 465
    };

    // Table header
    doc.save();
    doc.rect(36, cursorY - 4, 523, 22).fill('#e2e8f0');
    doc.restore();
    doc.fillColor('#0f172a').fontSize(9);
    doc.text('#', cols.sr, cursorY);
    doc.text('Medicine', cols.medicine, cursorY);
    doc.text('Dosage', cols.dosage, cursorY);
    doc.text('Qty', cols.qty, cursorY, { width: 30, align: 'right' });
    doc.text('Unit Price', cols.price, cursorY, { width: 58, align: 'right' });
    doc.text('Line Total', cols.total, cursorY, { width: 54, align: 'right' });
    cursorY += 26;

    items.forEach((item, index) => {
      if (cursorY > 730) {
        doc.addPage();
        cursorY = 60;
      }

      if (index % 2 === 0) {
        doc.save();
        doc.rect(36, cursorY - 3, 523, 18).fill('#f8fafc');
        doc.restore();
      }

      const medicineLabel = `${item.medicine_name}${item.brand_name ? ` (${item.brand_name})` : ''}`;
      doc.fillColor('#111827').fontSize(9);
      doc.text(String(index + 1), cols.sr, cursorY);
      doc.text(medicineLabel, cols.medicine, cursorY, { width: 205, ellipsis: true });
      doc.text(item.dosage || '-', cols.dosage, cursorY, { width: 95, ellipsis: true });
      doc.text(String(item.quantity), cols.qty, cursorY, { width: 30, align: 'right' });
      doc.text(formatAmount(item.unitPrice), cols.price, cursorY, { width: 58, align: 'right' });
      doc.text(formatAmount(item.lineTotal), cols.total, cursorY, { width: 54, align: 'right' });
      cursorY += 18;
    });

    const totalsY = Math.min(cursorY + 14, 760);
    doc.moveTo(360, totalsY).lineTo(559, totalsY).strokeColor('#cbd5e1').stroke();
    doc.fillColor('#111827').fontSize(10).text(`Subtotal: INR ${formatAmount(totals.subtotal)}`, 380, totalsY + 8, {
      width: 170,
      align: 'right'
    });
    doc.text(`GST (${(totals.taxRate * 100).toFixed(0)}%): INR ${formatAmount(totals.taxAmount)}`, 380, totalsY + 24, {
      width: 170,
      align: 'right'
    });
    doc.fontSize(12).fillColor('#0f172a').text(`Grand Total: INR ${formatAmount(totals.grandTotal)}`, 380, totalsY + 44, {
      width: 170,
      align: 'right'
    });

    doc.fontSize(9).fillColor('#64748b').text('System generated bill. Keep this for your records.', 36, 805, {
      width: 523,
      align: 'center'
    });

    doc.end();
  } catch (e) {
    next(e);
  }
}

async function getPrescriptionBillPreview(req, res, next) {
  try {
    const prescriptionId = Number(req.params.id);
    if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
      res.status(400);
      throw new Error('Invalid prescription ID');
    }

    const billData = await loadPrescriptionBillData(prescriptionId);
    if (!billData) {
      res.status(404);
      throw new Error('Prescription not found');
    }

    if (!billData.items.length) {
      res.status(422);
      throw new Error('No prescription medicines found for bill preview');
    }

    const { prescription, items, totals } = billData;
    res.json({
      prescriptionId,
      billNo: `RX-${prescriptionId}`,
      date: toDateOnly(prescription.date),
      customerName: prescription.customer_name || 'Walk-in Customer',
      doctorName: prescription.doctor_name || 'N/A',
      linkedCustomer: prescription.patient_name || 'N/A',
      notes: prescription.notes || null,
      items: items.map((item) => ({
        medicineId: item.medicine_id,
        medicineName: item.medicine_name,
        brandName: item.brand_name,
        dosage: item.dosage,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      })),
      totals
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getAllPrescriptions,
  getPrescriptionById,
  createPrescription,
  deletePrescription,
  downloadPrescriptionBill,
  getPrescriptionBillPreview
};

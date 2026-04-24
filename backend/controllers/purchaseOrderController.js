const pool = require('../config/db');
const makeResourceController = require('./resourceController');

const baseController = makeResourceController({
  tableName: 'purchase_order',
  idColumn: 'po_id',
  orderBy: 'po_id',
  allowedFields: ['order_date', 'total_amount', 'status', 'supplier_id'],
  requiredFields: ['order_date', 'supplier_id'],
  fieldValidators: {
    total_amount: (v) => {
      if (v === undefined || v === null || v === '') return true; // auto-calculated
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? true : 'total_amount must be a non-negative number';
    },
    order_date: (v) => {
      if (!v) return 'order_date is required';
      const d = new Date(v);
      if (isNaN(d.getTime())) return 'order_date must be a valid date';
      const future = new Date(); future.setDate(future.getDate() + 1);
      if (d > future) return 'order_date cannot be in the future';
      return true;
    },
    status: (v) => {
      if (!v) return true;
      return ['Pending','Approved','Received','Cancelled'].includes(v) ? true : 'Invalid status value';
    }
  }
});

// ─── GET all POs with supplier name + item count ────────────────────────────
async function getPurchaseOrdersWithSupplier(req, res, next) {
  try {
    const isPaginated = String(req.query.paginate || '').toLowerCase() === 'true';
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || '').trim();
    const sortable = ['po_id','order_date','total_amount','status','supplier_name'];
    const sortBy = sortable.includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'po_id';
    const sortOrder = String(req.query.sortOrder||'desc').toLowerCase()==='asc'?'ASC':'DESC';
    const orderCol = sortBy === 'supplier_name' ? 's.company_name' : `po.${sortBy}`;

    const where = search
      ? `WHERE CAST(po.po_id AS CHAR) LIKE ? OR CAST(po.order_date AS CHAR) LIKE ?
         OR CAST(po.total_amount AS CHAR) LIKE ? OR po.status LIKE ? OR s.company_name LIKE ?`
      : '';
    const params = search ? Array(5).fill(`%${search}%`) : [];

    const baseSQL = `SELECT po.*, s.company_name AS supplier_name, s.contact_number AS supplier_phone,
                            COALESCE(pm.item_count,0) AS item_count
                     FROM purchase_order po
                     JOIN supplier s ON po.supplier_id=s.supplier_id
                     LEFT JOIN (SELECT po_id, COUNT(*) AS item_count FROM po_medicine GROUP BY po_id) pm
                       ON pm.po_id=po.po_id
                     ${where} ORDER BY ${orderCol} ${sortOrder}`;

    if (!isPaginated) {
      const [rows] = await pool.query(baseSQL, params);
      return res.json(rows);
    }
    const offset = (page-1)*limit;
    const [rows] = await pool.query(`${baseSQL} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await pool.query(
      `SELECT COUNT(*) AS total FROM purchase_order po JOIN supplier s ON po.supplier_id=s.supplier_id ${where}`, params
    );
    res.json({ data:rows, pagination:{ page,limit,total:cnt[0].total, totalPages:Math.max(1,Math.ceil(cnt[0].total/limit)), search,sortBy,sortOrder:sortOrder.toLowerCase() } });
  } catch(e) { next(e); }
}

// ─── CREATE PO with line items ───────────────────────────────────────────────
async function createPurchaseOrder(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { order_date, supplier_id, status = 'Pending', items = [] } = req.body;
    if (!order_date) { res.status(422); return next(new Error('order_date is required')); }
    if (!supplier_id) { res.status(422); return next(new Error('supplier_id is required')); }
    if (!Array.isArray(items) || items.length === 0) { res.status(422); return next(new Error('At least one item is required')); }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.medicine_id) return next(Object.assign(new Error(`Item ${i+1}: medicine_id required`), { status: 422 }));
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty <= 0) { res.status(422); return next(new Error(`Item ${i+1}: quantity must be positive integer`)); }
      const price = Number(it.purchase_price);
      if (!Number.isFinite(price) || price < 0) { res.status(422); return next(new Error(`Item ${i+1}: purchase_price must be non-negative`)); }
    }

    const total_amount = items.reduce((s, it) => s + Number(it.quantity) * Number(it.purchase_price), 0);

    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO purchase_order (order_date, total_amount, status, supplier_id) VALUES (?,?,?,?)',
      [order_date, total_amount.toFixed(2), status, supplier_id]
    );
    const po_id = result.insertId;

    for (const it of items) {
      await conn.query(
        'INSERT INTO po_medicine (po_id, medicine_id, quantity, purchase_price) VALUES (?,?,?,?)',
        [po_id, it.medicine_id, Number(it.quantity), Number(it.purchase_price)]
      );
    }
    await conn.commit();
    res.status(201).json({ po_id, total_amount, message: 'Purchase order created' });
  } catch(e) { await conn.rollback(); next(e); } finally { conn.release(); }
}

// ─── GET PO by ID with line items ───────────────────────────────────────────
async function getPOById(req, res, next) {
  try {
    const [pos] = await pool.query(
      `SELECT po.*, s.company_name AS supplier_name, s.contact_number AS supplier_phone
       FROM purchase_order po JOIN supplier s ON po.supplier_id=s.supplier_id
       WHERE po.po_id=?`, [req.params.id]
    );
    if (!pos.length) { res.status(404); return next(new Error('Purchase order not found')); }
    const [items] = await pool.query(
      `SELECT pm.*, m.medicine_name, m.brand_name, m.unit_price AS current_price
       FROM po_medicine pm JOIN medicine m ON pm.medicine_id=m.medicine_id
       WHERE pm.po_id=?`, [req.params.id]
    );
    res.json({ ...pos[0], items });
  } catch(e) { next(e); }
}

// ─── UPDATE PO status (and optionally receive stock) ────────────────────────
async function updatePOStatus(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { status, receive_as_batches } = req.body;
    if (!['Pending','Approved','Received','Cancelled'].includes(status)) {
      res.status(422); return next(new Error('Invalid status'));
    }

    const [pos] = await conn.query('SELECT * FROM purchase_order WHERE po_id=?', [req.params.id]);
    if (!pos.length) { res.status(404); return next(new Error('Purchase order not found')); }
    const po = pos[0];

    await conn.beginTransaction();
    await conn.query('UPDATE purchase_order SET status=? WHERE po_id=?', [status, req.params.id]);

    // Auto-create batches when marking Received with batch data
    if (status === 'Received' && receive_as_batches && Array.isArray(receive_as_batches) && receive_as_batches.length > 0) {
      for (const b of receive_as_batches) {
        if (!b.expiry_date) continue;
        const expiry = new Date(b.expiry_date);
        const today = new Date(); today.setHours(0,0,0,0);
        if (expiry <= today) continue; // skip invalid
        const batchNum = b.batch_number || `PO${req.params.id}-M${b.medicine_id}-${Date.now()}`;
        await conn.query(
          'INSERT INTO batch (batch_number, manufacture_date, expiry_date, batch_quantity, medicine_id) VALUES (?,?,?,?,?)',
          [batchNum, b.manufacture_date || null, b.expiry_date, Number(b.quantity), Number(b.medicine_id)]
        );
      }
    }

    await conn.commit();
    res.json({ message: `Order marked as ${status}` });
  } catch(e) { await conn.rollback(); next(e); } finally { conn.release(); }
}

// ─── DELETE PO ───────────────────────────────────────────────────────────────
async function deletePO(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM purchase_order WHERE po_id=?', [req.params.id]);
    if (!result.affectedRows) { res.status(404); return next(new Error('Purchase order not found')); }
    res.json({ message: 'Purchase order deleted' });
  } catch(e) { next(e); }
}

module.exports = { getPurchaseOrdersWithSupplier, createPurchaseOrder, getPOById, updatePOStatus, deletePO };

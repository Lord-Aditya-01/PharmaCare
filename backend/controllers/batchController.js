const pool = require('../config/db');
const makeResourceController = require('./resourceController');

function isValidDate(str) {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function validateBatchDates(data) {
  const { manufacture_date, expiry_date } = data;
  if (!expiry_date || !isValidDate(expiry_date)) return 'expiry_date is required and must be a valid date';
  const expiry = new Date(expiry_date);
  const today = new Date(); today.setHours(0,0,0,0);
  if (expiry <= today) return 'expiry_date must be a future date';
  if (manufacture_date) {
    if (!isValidDate(manufacture_date)) return 'manufacture_date must be a valid date';
    const mfg = new Date(manufacture_date);
    if (mfg >= expiry) return 'manufacture_date must be strictly before expiry_date';
    if (mfg > today) return 'manufacture_date cannot be in the future';
  }
  return null;
}

const base = makeResourceController({
  tableName: 'batch', idColumn: 'batch_id', orderBy: 'batch_id',
  allowedFields: ['batch_number','manufacture_date','expiry_date','batch_quantity','medicine_id'],
  requiredFields: ['batch_number','expiry_date','batch_quantity','medicine_id'],
  fieldValidators: {
    batch_quantity: v => { const n=Number(v); return Number.isInteger(n)&&n>0 ? true : 'batch_quantity must be a positive integer'; }
  }
});

const origCreate = base.create;
base.create = async function(req,res,next) {
  const err = validateBatchDates(req.body);
  if (err) { res.status(400); return next(new Error(err)); }
  return origCreate(req,res,next);
};

const origUpdate = base.update;
base.update = async function(req,res,next) {
  const { manufacture_date, expiry_date } = req.body;
  if (manufacture_date || expiry_date) {
    try {
      const [rows] = await pool.query('SELECT manufacture_date, expiry_date FROM batch WHERE batch_id=?',[req.params.id]);
      if (!rows.length) { res.status(404); return next(new Error('batch record not found')); }
      const merged = { manufacture_date: manufacture_date??rows[0].manufacture_date, expiry_date: expiry_date??rows[0].expiry_date };
      const err = validateBatchDates(merged);
      if (err) { res.status(400); return next(new Error(err)); }
    } catch(e) { return next(e); }
  }
  return origUpdate(req,res,next);
};

async function getExpiryAlerts(req,res,next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days||60),1),365);
    const [rows] = await pool.query(
      `SELECT b.*, m.medicine_name, DATEDIFF(b.expiry_date,CURDATE()) AS days_until_expiry
       FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id
       WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiry_date ASC`, [days]
    );
    res.json(rows);
  } catch(e) { next(e); }
}

async function importBatches(req,res,next) {
  const { batches } = req.body;
  if (!Array.isArray(batches)||batches.length===0) { res.status(400); return next(new Error('batches array is required')); }
  if (batches.length>500) { res.status(400); return next(new Error('Cannot import more than 500 batches at once')); }

  const errors=[]; const valid=[];
  for (let i=0;i<batches.length;i++) {
    const b=batches[i]; const row=i+1;
    if (!b.batch_number?.toString().trim()) { errors.push({row,message:'batch_number is required'}); continue; }
    if (!b.medicine_id||isNaN(Number(b.medicine_id))) { errors.push({row,message:'medicine_id must be a valid number'}); continue; }
    const qty=Number(b.batch_quantity);
    if (!Number.isInteger(qty)||qty<=0) { errors.push({row,message:'batch_quantity must be a positive integer'}); continue; }
    const dateErr = validateBatchDates(b);
    if (dateErr) { errors.push({row,message:dateErr}); continue; }
    valid.push({ batch_number:String(b.batch_number).trim(), manufacture_date:b.manufacture_date||null, expiry_date:b.expiry_date, batch_quantity:qty, medicine_id:Number(b.medicine_id) });
  }

  if (errors.length>0) { res.status(422); return next(Object.assign(new Error('Validation failed for one or more rows'),{details:errors})); }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const inserted=[];
    for (const b of valid) {
      const [r] = await conn.query('INSERT INTO batch (batch_number,manufacture_date,expiry_date,batch_quantity,medicine_id) VALUES (?,?,?,?,?)',
        [b.batch_number,b.manufacture_date,b.expiry_date,b.batch_quantity,b.medicine_id]);
      inserted.push(r.insertId);
    }
    await conn.commit();
    res.status(201).json({ message:`${inserted.length} batch(es) imported successfully`, inserted });
  } catch(e) { await conn.rollback(); next(e); } finally { conn.release(); }
}

// Override getAll to always include medicine_name, days_until_expiry, and support sorting by them
async function getAllBatches(req, res, next) {
  try {
    const isPaginated = String(req.query.paginate || '').toLowerCase() === 'true';
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || '').trim();
    const validSort = ['batch_id','batch_number','expiry_date','manufacture_date','batch_quantity','medicine_id','days_until_expiry'];
    const sortBy = validSort.includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'expiry_date';
    const sortOrder = String(req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const sortCol = sortBy === 'days_until_expiry' ? 'DATEDIFF(b.expiry_date, CURDATE())' : `b.${sortBy}`;

    const whereParts = [];
    const params = [];
    if (search) {
      whereParts.push(`(b.batch_number LIKE ? OR m.medicine_name LIKE ? OR CAST(b.batch_id AS CHAR) LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const base = `SELECT b.*, m.medicine_name, m.brand_name,
                         DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry
                  FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id
                  ${where} ORDER BY ${sortCol} ${sortOrder}`;

    if (!isPaginated) {
      const [rows] = await pool.query(base, params);
      return res.json(rows);
    }
    const offset = (page-1)*limit;
    const [rows] = await pool.query(`${base} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id ${where}`, params);
    const total = cnt[0].total;
    res.json({ data:rows, pagination:{ page,limit,total, totalPages:Math.max(1,Math.ceil(total/limit)), search,sortBy,sortOrder:sortOrder.toLowerCase() } });
  } catch(e) { next(e); }
}

module.exports = { ...base, getAll: getAllBatches, getExpiryAlerts, importBatches };

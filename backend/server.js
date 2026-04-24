const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const { protect } = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const makeResourceController = require('./controllers/resourceController');
const makeResourceRouter = require('./routes/resourceRoutes');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const batchRoutes = require('./routes/batchRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');

const app = express();

const isNonEmptyString = (label) => (value) =>
  typeof value === 'string' && value.trim().length > 0 ? true : `${label} must be a non-empty string`;

const isOptionalString = (label, max = 255) => (value) => {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && value.trim().length <= max
    ? true
    : `${label} must be a valid text value`;
};

const isNonNegativeNumber = (label) => (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? true : `${label} must be a non-negative number`;
};

const isOptionalPositiveInt = (label) => (value) => {
  if (value === undefined || value === null || value === '') return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? true : `${label} must be a positive integer`;
};

const isOptionalRating = (value) => {
  if (value === undefined || value === null || value === '') return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 5
    ? true
    : 'rating must be between 0 and 5';
};

const isOptionalGender = (value) => {
  if (value === undefined || value === null || value === '') return true;
  return ['Male', 'Female', 'Other'].includes(String(value))
    ? true
    : 'gender must be Male, Female, or Other';
};

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hospital Pharmacy API is running' });
});

app.use('/api/auth', authRoutes);

const medicineController = makeResourceController({
  tableName: 'medicine',
  idColumn: 'medicine_id',
  orderBy: 'medicine_id',
  allowedFields: ['medicine_name', 'brand_name', 'generic_name', 'category', 'unit_price', 'storage_type', 'min_stock_level'],
  requiredFields: ['medicine_name', 'unit_price', 'min_stock_level'],
  fieldValidators: {
    medicine_name: isNonEmptyString('medicine_name'),
    brand_name: isOptionalString('brand_name', 150),
    generic_name: isOptionalString('generic_name', 150),
    category: isOptionalString('category', 100),
    unit_price: isNonNegativeNumber('unit_price'),
    storage_type: isOptionalString('storage_type', 100),
    min_stock_level: isNonNegativeNumber('min_stock_level')
  }
});

const medicineListFields = ['medicine_name', 'brand_name', 'generic_name', 'category', 'unit_price', 'storage_type', 'min_stock_level', 'current_stock'];
const medicineSortColumns = {
  medicine_id: 'm.medicine_id',
  medicine_name: 'm.medicine_name',
  brand_name: 'm.brand_name',
  generic_name: 'm.generic_name',
  category: 'm.category',
  unit_price: 'm.unit_price',
  storage_type: 'm.storage_type',
  min_stock_level: 'm.min_stock_level',
  current_stock: 'm.current_stock',
  batch_count: 'COALESCE(b.batch_count, 0)'
};

medicineController.getAll = async (req, res, next) => {
  try {
    const isPaginated = String(req.query.paginate || '').toLowerCase() === 'true';
    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;
    const search = String(req.query.search || '').trim();
    const sortableFields = Object.keys(medicineSortColumns);
    const requestedSortBy = String(req.query.sortBy || 'medicine_id');
    const sortBy = sortableFields.includes(requestedSortBy) ? requestedSortBy : 'medicine_id';
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderBySql = medicineSortColumns[sortBy];

    const whereParts = [];
    const params = [];
    const categoryFilter = String(req.query.category || '').trim();
    const stockFilter = String(req.query.stock_status || '').trim();

    if (search) {
      const searchClauses = medicineListFields.map((field) => `CAST(m.${field} AS CHAR) LIKE ?`);
      whereParts.push(`(${searchClauses.join(' OR ')})`);
      medicineListFields.forEach(() => params.push(`%${search}%`));
    }
    if (categoryFilter && categoryFilter !== 'all') {
      whereParts.push('m.category = ?');
      params.push(categoryFilter);
    }
    if (stockFilter === 'out_of_stock') whereParts.push('m.current_stock = 0');
    else if (stockFilter === 'low_stock') whereParts.push('m.current_stock > 0 AND m.current_stock <= m.min_stock_level');
    else if (stockFilter === 'ok') whereParts.push('m.current_stock > m.min_stock_level');

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const baseSelect = `
      SELECT m.medicine_id,
             m.medicine_name,
             m.brand_name,
             m.generic_name,
             m.category,
             m.unit_price,
             m.min_stock_level,
             COALESCE(m.current_stock, 0) AS current_stock,
             m.storage_type,
             COALESCE(b.batch_count, 0) AS batch_count,
             nx.nearest_expiry,
             DATEDIFF(nx.nearest_expiry, CURDATE()) AS days_to_expiry
      FROM medicine m
      LEFT JOIN (
        SELECT medicine_id, COUNT(*) AS batch_count
        FROM batch
        GROUP BY medicine_id
      ) b ON m.medicine_id = b.medicine_id
      LEFT JOIN (
        SELECT medicine_id, MIN(expiry_date) AS nearest_expiry
        FROM batch
        WHERE expiry_date >= CURDATE()
        GROUP BY medicine_id
      ) nx ON m.medicine_id = nx.medicine_id
      ${whereSql}
      ORDER BY ${orderBySql} ${sortOrder}`;

    if (!isPaginated) {
      const [rows] = await pool.query(baseSelect, params);
      res.json(rows);
      return;
    }

    const offset = (page - 1) * limit;
    const [rows] = await pool.query(`${baseSelect} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM medicine m ${whereSql}`, params);

    const total = countRows[0].total;
    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        search,
        sortBy,
        sortOrder: sortOrder.toLowerCase()
      }
    });
  } catch (error) {
    next(error);
  }
};

async function ensurePrescriptionSchema() {
  // Add customer_name if missing (migration for existing DBs)
  const [cols] = await pool.query("SHOW COLUMNS FROM prescription LIKE 'customer_name'");
  if (!cols.length) {
    await pool.query("ALTER TABLE prescription ADD COLUMN customer_name VARCHAR(200) NOT NULL DEFAULT 'Walk-in Customer' AFTER date");
    await pool.query("UPDATE prescription SET customer_name='Walk-in Customer' WHERE customer_name=''");
  }
  // Make patient_id nullable if not already
  const [patCols] = await pool.query("SHOW COLUMNS FROM prescription LIKE 'patient_id'");
  if (patCols.length && patCols[0].Null === 'NO') {
    await pool.query("ALTER TABLE prescription MODIFY patient_id INT DEFAULT NULL");
    await pool.query("ALTER TABLE prescription DROP FOREIGN KEY IF EXISTS fk_prescription_patient").catch(()=>{});
    await pool.query(`ALTER TABLE prescription ADD CONSTRAINT fk_prescription_patient
      FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON UPDATE CASCADE ON DELETE SET NULL`).catch(()=>{});
  }
  // Add notes column if missing
  const [notesCols] = await pool.query("SHOW COLUMNS FROM prescription LIKE 'notes'");
  if (!notesCols.length) {
    await pool.query("ALTER TABLE prescription ADD COLUMN notes VARCHAR(500) DEFAULT NULL");
  }
  // Add activity_log table if missing
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    description TEXT NOT NULL,
    quantity_change INT DEFAULT NULL,
    medicine_id INT DEFAULT NULL,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(User_ID) ON DELETE SET NULL
  )`);
}

async function ensureInventorySyncSchema() {
  const [currentStockColumns] = await pool.query(
    "SHOW COLUMNS FROM medicine LIKE 'current_stock'"
  );

  if (currentStockColumns.length === 0) {
    await pool.query('ALTER TABLE medicine ADD COLUMN current_stock INT NOT NULL DEFAULT 0 AFTER min_stock_level');
  }

  await pool.query(`
    UPDATE medicine m
    LEFT JOIN (
      SELECT medicine_id, COALESCE(SUM(batch_quantity), 0) AS batch_stock
      FROM batch
      GROUP BY medicine_id
    ) b ON b.medicine_id = m.medicine_id
    LEFT JOIN (
      SELECT pm.medicine_id, COALESCE(SUM(pm.quantity), 0) AS prescription_stock
      FROM prescription_medicine pm
      GROUP BY pm.medicine_id
    ) p ON p.medicine_id = m.medicine_id
    SET m.current_stock = GREATEST(COALESCE(b.batch_stock, 0) - COALESCE(p.prescription_stock, 0), 0)
  `);

  await pool.query('DROP TRIGGER IF EXISTS medicine_batch_after_insert');
  await pool.query('DROP TRIGGER IF EXISTS medicine_batch_after_update');
  await pool.query('DROP TRIGGER IF EXISTS medicine_batch_after_delete');
  await pool.query('DROP TRIGGER IF EXISTS medicine_prescription_medicine_before_insert');
  await pool.query('DROP TRIGGER IF EXISTS medicine_prescription_medicine_after_delete');

  await pool.query(`
    CREATE TRIGGER medicine_batch_after_insert
    AFTER INSERT ON batch
    FOR EACH ROW
    UPDATE medicine
    SET current_stock = current_stock + NEW.batch_quantity
    WHERE medicine_id = NEW.medicine_id
  `);

  await pool.query(`
    CREATE TRIGGER medicine_batch_after_update
    AFTER UPDATE ON batch
    FOR EACH ROW
    UPDATE medicine
    SET current_stock = current_stock
      - CASE WHEN medicine_id = OLD.medicine_id THEN OLD.batch_quantity ELSE 0 END
      + CASE WHEN medicine_id = NEW.medicine_id THEN NEW.batch_quantity ELSE 0 END
    WHERE medicine_id IN (OLD.medicine_id, NEW.medicine_id)
  `);

  await pool.query(`
    CREATE TRIGGER medicine_batch_after_delete
    AFTER DELETE ON batch
    FOR EACH ROW
    UPDATE medicine
    SET current_stock = GREATEST(current_stock - OLD.batch_quantity, 0)
    WHERE medicine_id = OLD.medicine_id
  `);

  await pool.query(`
    CREATE TRIGGER medicine_prescription_medicine_before_insert
    BEFORE INSERT ON prescription_medicine
    FOR EACH ROW
    BEGIN
      DECLARE available_stock INT;

      SELECT current_stock INTO available_stock
      FROM medicine
      WHERE medicine_id = NEW.medicine_id;

      IF available_stock IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicine not found';
      END IF;

      IF available_stock < NEW.quantity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient medicine stock';
      END IF;

      UPDATE medicine
      SET current_stock = current_stock - NEW.quantity
      WHERE medicine_id = NEW.medicine_id;
    END
  `);

  await pool.query(`
    CREATE TRIGGER medicine_prescription_medicine_after_delete
    AFTER DELETE ON prescription_medicine
    FOR EACH ROW
    UPDATE medicine
    SET current_stock = current_stock + OLD.quantity
    WHERE medicine_id = OLD.medicine_id
  `);
}

const supplierController = makeResourceController({
  tableName: 'supplier',
  idColumn: 'supplier_id',
  orderBy: 'supplier_id',
  allowedFields: ['company_name', 'contact_first', 'contact_last', 'contact_number', 'address', 'license_number', 'rating'],
  requiredFields: ['company_name', 'contact_first', 'contact_last'],
  fieldValidators: {
    company_name: isNonEmptyString('company_name'),
    contact_first: isNonEmptyString('contact_first'),
    contact_last: isNonEmptyString('contact_last'),
    contact_number: isOptionalString('contact_number', 30),
    address: isOptionalString('address', 255),
    license_number: isOptionalString('license_number', 80),
    rating: isOptionalRating
  }
});

const patientController = makeResourceController({
  tableName: 'patient',
  idColumn: 'patient_id',
  orderBy: 'patient_id',
  allowedFields: ['first_name', 'last_name', 'age', 'gender', 'contact'],
  requiredFields: ['first_name', 'last_name'],
  fieldValidators: {
    first_name: isNonEmptyString('first_name'),
    last_name: isNonEmptyString('last_name'),
    age: isOptionalPositiveInt('age'),
    gender: isOptionalGender,
    contact: isOptionalString('contact', 30)
  }
});

const doctorController = makeResourceController({
  tableName: 'doctor',
  idColumn: 'doctor_id',
  orderBy: 'doctor_id',
  allowedFields: ['first_name', 'last_name', 'specialization', 'contact'],
  requiredFields: ['first_name', 'last_name'],
  fieldValidators: {
    first_name: isNonEmptyString('first_name'),
    last_name: isNonEmptyString('last_name'),
    specialization: isOptionalString('specialization', 120),
    contact: isOptionalString('contact', 30)
  }
});

app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/medicines', protect, makeResourceRouter(medicineController));
app.use('/api/suppliers', protect, makeResourceRouter(supplierController));
app.use('/api/patients', protect, makeResourceRouter(patientController));
app.use('/api/doctors', protect, makeResourceRouter(doctorController));
app.use('/api/batches', protect, batchRoutes);
app.use('/api/purchase-orders', protect, purchaseOrderRoutes);

// ─── Stock Adjustment endpoint ──────────────────────────────────────────────
app.post('/api/medicines/:id/adjust-stock', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400); return next(new Error('Invalid ID')); }
    const { quantity, reason } = req.body;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty === 0) { res.status(422); return next(new Error('quantity must be a non-zero integer')); }
    if (!reason || !reason.trim()) { res.status(422); return next(new Error('reason is required')); }

    const [meds] = await pool.query('SELECT * FROM medicine WHERE medicine_id=?', [id]);
    if (!meds.length) { res.status(404); return next(new Error('Medicine not found')); }

    const newStock = Math.max(0, meds[0].current_stock + qty);
    await pool.query('UPDATE medicine SET current_stock=? WHERE medicine_id=?', [newStock, id]);

    // Log it
    await pool.query(
      `INSERT INTO activity_log (action_type, entity_type, entity_id, description, quantity_change, medicine_id, user_id)
       VALUES ('stock_adjusted','medicine',?,'Stock adjustment: '+?, ?, ?, ?)`,
      [id, reason.trim(), qty, id, req.user?.id || null]
    ).catch(() => {}); // non-blocking

    res.json({ medicine_id: id, previous_stock: meds[0].current_stock, new_stock: newStock, adjustment: qty, reason });
  } catch(e) { next(e); }
});

// ─── Activity Log endpoint ───────────────────────────────────────────────────
app.get('/api/activity-log', protect, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const action_type = req.query.action_type || '';
    const where = action_type ? 'WHERE al.action_type=?' : '';
    const params = action_type ? [action_type] : [];
    const [rows] = await pool.query(
      `SELECT al.*, u.name AS user_name, m.medicine_name
       FROM activity_log al
       LEFT JOIN users u ON al.user_id=u.User_ID
       LEFT JOIN medicine m ON al.medicine_id=m.medicine_id
       ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM activity_log al ${where}`, params);
    res.json({ data: rows, total: cnt[0].total });
  } catch(e) { next(e); }
});
app.use('/api/prescriptions', protect, prescriptionRoutes);

app.use(notFound);
app.use(errorHandler);

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      User_ID INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'pharmacist',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const PORT = process.env.PORT || 5000;

ensureUsersTable()
  .then(() => ensurePrescriptionSchema())
  .then(() => ensureInventorySyncSchema())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to initialize database:', error.message);
    process.exit(1);
  });

const pool = require('../config/db');

async function getSummary(req, res, next) {
  try {
    const [[mr],[sr],[pr],[dr],[er],[ir],[rxr],[por]] = await Promise.all([
      pool.query('SELECT COUNT(*) AS totalMedicines FROM medicine'),
      pool.query('SELECT COUNT(*) AS totalSuppliers FROM supplier'),
      pool.query('SELECT COUNT(*) AS totalPatients FROM patient'),
      pool.query('SELECT COUNT(*) AS totalDoctors FROM doctor'),
      pool.query(`SELECT COUNT(*) AS expiringBatches FROM batch WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)`),
      pool.query(`SELECT COALESCE(SUM(m.current_stock),0) AS totalStockUnits,
                         COALESCE(SUM(CASE WHEN m.current_stock=0 THEN 1 ELSE 0 END),0) AS outOfStockMedicines,
                         COALESCE(SUM(CASE WHEN m.current_stock>0 AND m.current_stock<=m.min_stock_level THEN 1 ELSE 0 END),0) AS lowStockMedicines
                  FROM medicine m`),
      pool.query(`SELECT COUNT(*) AS totalPrescriptions FROM prescription WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`),
      pool.query(`SELECT COUNT(*) AS pendingOrders FROM purchase_order WHERE status='Pending'`)
    ]);
    res.json({
      totalMedicines: mr[0].totalMedicines,
      totalSuppliers: sr[0].totalSuppliers,
      totalPatients: pr[0].totalPatients,
      totalDoctors: dr[0].totalDoctors,
      expiringBatches: er[0].expiringBatches,
      totalStockUnits: ir[0].totalStockUnits,
      outOfStockMedicines: ir[0].outOfStockMedicines,
      lowStockMedicines: ir[0].lowStockMedicines,
      prescriptionsLast30Days: rxr[0].totalPrescriptions,
      pendingOrders: por[0].pendingOrders
    });
  } catch (e) { next(e); }
}

async function getLowStock(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT m.medicine_id, m.medicine_name, m.brand_name, m.category,
              m.current_stock, m.min_stock_level, m.unit_price,
              COALESCE(b.batch_count,0) AS batch_count,
              CASE WHEN m.current_stock=0 THEN 'out_of_stock' ELSE 'low_stock' END AS stock_status
       FROM medicine m
       LEFT JOIN (SELECT medicine_id, COUNT(*) AS batch_count FROM batch GROUP BY medicine_id) b
         ON m.medicine_id=b.medicine_id
       WHERE m.current_stock <= m.min_stock_level
       ORDER BY m.current_stock ASC, m.medicine_name ASC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getExpiringBatches(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days||90),1),365);
    const [rows] = await pool.query(
      `SELECT b.batch_id, b.batch_number, b.manufacture_date, b.expiry_date, b.batch_quantity,
              m.medicine_id, m.medicine_name, m.brand_name, m.unit_price,
              DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry,
              ROUND(b.batch_quantity*m.unit_price,2) AS stock_value,
              CASE WHEN DATEDIFF(b.expiry_date,CURDATE())<30 THEN 'critical'
                   WHEN DATEDIFF(b.expiry_date,CURDATE())<60 THEN 'warning'
                   ELSE 'notice' END AS urgency
       FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id
       WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiry_date ASC`, [days]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getAnalytics(req, res, next) {
  try {
    const [topMed] = await pool.query(
      `SELECT m.medicine_name, SUM(pm.quantity) AS total_prescribed
       FROM prescription_medicine pm JOIN medicine m ON pm.medicine_id=m.medicine_id
       GROUP BY m.medicine_id, m.medicine_name ORDER BY total_prescribed DESC LIMIT 5`
    );
    const [spend] = await pool.query(
      `SELECT DATE_FORMAT(po.order_date,'%Y-%m') AS month_key,
              DATE_FORMAT(po.order_date,'%b %Y') AS month_label,
              ROUND(SUM(po.total_amount),2) AS total_spend
       FROM purchase_order po WHERE po.order_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY month_key, month_label ORDER BY month_key ASC`
    );
    const [risk] = await pool.query(
      `SELECT CASE WHEN DATEDIFF(b.expiry_date,CURDATE())<30 THEN 'Critical (<30d)'
                   WHEN DATEDIFF(b.expiry_date,CURDATE())<=60 THEN 'Warning (30-60d)'
                   ELSE 'Safe (>60d)' END AS risk_level,
              COUNT(*) AS batch_count,
              ROUND(SUM(b.batch_quantity*m.unit_price),2) AS stock_value
       FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id
       WHERE b.expiry_date >= CURDATE()
       GROUP BY risk_level ORDER BY FIELD(risk_level,'Critical (<30d)','Warning (30-60d)','Safe (>60d)')`
    );
    const [cat] = await pool.query(
      `SELECT COALESCE(category,'Uncategorized') AS category,
              COUNT(*) AS medicine_count, COALESCE(SUM(current_stock),0) AS total_stock
       FROM medicine GROUP BY category ORDER BY medicine_count DESC LIMIT 6`
    );

    const monthMap = new Map(spend.map(r=>[r.month_key,{month:r.month_label,spend:Number(r.total_spend||0)}]));
    const monthlySpend = [];
    const today = new Date();
    for (let i=5;i>=0;i--) {
      const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlySpend.push(monthMap.get(key)||{month:d.toLocaleDateString('en-US',{month:'short',year:'numeric'}),spend:0});
    }

    res.json({
      topMedicines: topMed.map(r=>({medicine:r.medicine_name,quantity:Number(r.total_prescribed||0)})),
      monthlySpend,
      expiryRisk: risk.map(r=>({level:r.risk_level,batches:Number(r.batch_count||0),value:Number(r.stock_value||0)})),
      categoryBreakdown: cat.map(r=>({category:r.category,count:Number(r.medicine_count),stock:Number(r.total_stock)}))
    });
  } catch(e) { next(e); }
}

async function getInventoryReport(req, res, next) {
  try {
    const { category, stock_status, search } = req.query;
    let w=[]; let p=[];
    if (category && category!=='all') { w.push('m.category=?'); p.push(category); }
    if (stock_status==='out_of_stock') w.push('m.current_stock=0');
    else if (stock_status==='low_stock') w.push('m.current_stock>0 AND m.current_stock<=m.min_stock_level');
    else if (stock_status==='ok') w.push('m.current_stock>m.min_stock_level');
    if (search) { w.push('(m.medicine_name LIKE ? OR m.brand_name LIKE ? OR m.generic_name LIKE ?)'); p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT m.medicine_id, m.medicine_name, m.brand_name, m.generic_name, m.category,
              m.unit_price, m.min_stock_level, COALESCE(m.current_stock,0) AS current_stock,
              COALESCE(b.batch_count,0) AS batch_count,
              ROUND(COALESCE(m.current_stock,0)*m.unit_price,2) AS stock_value,
              m.storage_type,
              CASE WHEN COALESCE(m.current_stock,0)=0 THEN 'out_of_stock'
                   WHEN COALESCE(m.current_stock,0)<=m.min_stock_level THEN 'low_stock'
                   ELSE 'ok' END AS stock_status
       FROM medicine m
       LEFT JOIN (SELECT medicine_id, COUNT(*) AS batch_count FROM batch GROUP BY medicine_id) b ON m.medicine_id=b.medicine_id
       ${where} ORDER BY m.medicine_name ASC`, p
    );
    res.json(rows);
  } catch(e) { next(e); }
}

async function getPurchaseReport(req, res, next) {
  try {
    const { status, supplier_id, from_date, to_date } = req.query;
    let w=[]; let p=[];
    if (status && status!=='all') { w.push('po.status=?'); p.push(status); }
    if (supplier_id && supplier_id!=='all') { w.push('po.supplier_id=?'); p.push(Number(supplier_id)); }
    if (from_date) { w.push('po.order_date>=?'); p.push(from_date); }
    if (to_date) { w.push('po.order_date<=?'); p.push(to_date); }
    const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT po.po_id, po.order_date, po.total_amount, po.status,
              s.company_name AS supplier_name
       FROM purchase_order po JOIN supplier s ON po.supplier_id=s.supplier_id
       ${where} ORDER BY po.order_date DESC`, p
    );
    res.json(rows);
  } catch(e) { next(e); }
}

function csvSafe(v) {
  if (v===null||v===undefined) return '';
  const t=String(v);
  return (t.includes(',')||t.includes('"')||t.includes('\n')) ? `"${t.replace(/"/g,'""')}"` : t;
}

function sendCSV(res, headers, rows, filename) {
  const lines=[headers.join(',')];
  rows.forEach(r=>lines.push(headers.map(h=>csvSafe(r[h])).join(',')));
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="${filename}-${new Date().toISOString().slice(0,10)}.csv"`);
  res.status(200).send(lines.join('\n'));
}

async function exportInventoryReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT m.medicine_id, m.medicine_name, m.brand_name, m.generic_name, m.category,
              m.unit_price, m.min_stock_level, COALESCE(m.current_stock,0) AS current_stock,
              COALESCE(b.batch_count,0) AS batch_count,
              ROUND(COALESCE(m.current_stock,0)*m.unit_price,2) AS stock_value,
              CASE WHEN COALESCE(m.current_stock,0)=0 THEN 'OUT_OF_STOCK'
                   WHEN COALESCE(m.current_stock,0)<=m.min_stock_level THEN 'LOW_STOCK'
                   ELSE 'OK' END AS stock_status
       FROM medicine m
       LEFT JOIN (SELECT medicine_id,COUNT(*) AS batch_count FROM batch GROUP BY medicine_id) b ON m.medicine_id=b.medicine_id
       ORDER BY m.medicine_name ASC`
    );
    sendCSV(res,['medicine_id','medicine_name','brand_name','generic_name','category','unit_price','min_stock_level','current_stock','batch_count','stock_value','stock_status'],rows,'inventory-report');
  } catch(e) { next(e); }
}

async function exportExpiryReport(req, res, next) {
  try {
    const days = Number(req.query.days||90);
    const [rows] = await pool.query(
      `SELECT b.batch_id, b.batch_number, b.manufacture_date, b.expiry_date, b.batch_quantity,
              m.medicine_name, m.brand_name, m.unit_price,
              DATEDIFF(b.expiry_date,CURDATE()) AS days_until_expiry,
              ROUND(b.batch_quantity*m.unit_price,2) AS at_risk_value
       FROM batch b JOIN medicine m ON b.medicine_id=m.medicine_id
       WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiry_date ASC`, [days]
    );
    sendCSV(res,['batch_id','batch_number','medicine_name','brand_name','manufacture_date','expiry_date','days_until_expiry','batch_quantity','unit_price','at_risk_value'],rows,'expiry-report');
  } catch(e) { next(e); }
}

module.exports = { getSummary, getLowStock, getExpiringBatches, getAnalytics, getInventoryReport, getPurchaseReport, exportInventoryReport, exportExpiryReport };

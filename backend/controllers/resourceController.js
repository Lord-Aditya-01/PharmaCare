const baseModel = require('../models/baseModel');
const pool = require('../config/db');

function makeResourceController({ tableName, idColumn, orderBy, allowedFields, requiredFields=[], fieldValidators={} }) {
  const pick = body => { const d={}; allowedFields.forEach(f=>{ if(body[f]!==undefined) d[f]=body[f]; }); return d; };
  const validate = (data, isUpdate=false) => {
    if (!Object.keys(data).length) return 'No valid fields provided';
    if (!isUpdate) {
      const miss = requiredFields.find(f=>{ const v=data[f]; return v===undefined||v===null||String(v).trim()===''; });
      if (miss) return `${miss} is required`;
    }
    for (const f of Object.keys(data)) {
      const v = fieldValidators[f]; if (!v) continue;
      const r = v(data[f], data);
      if (r!==true) return typeof r==='string' ? r : `Invalid value for ${f}`;
    }
    return null;
  };

  const buildList = q => {
    const isPag = String(q.paginate||'').toLowerCase()==='true';
    const page = Math.max(Number.isFinite(Number(q.page))&&Number(q.page)>0?Number(q.page):1, 1);
    const limit = Math.min(Number.isFinite(Number(q.limit))&&Number(q.limit)>0?Number(q.limit):10, 100);
    const search = String(q.search||'').trim();
    const sortable = [idColumn,...allowedFields];
    const sortBy = sortable.includes(String(q.sortBy||'')) ? String(q.sortBy) : (orderBy||idColumn);
    const sortOrder = String(q.sortOrder||'desc').toLowerCase()==='asc' ? 'ASC' : 'DESC';
    const where=[]; const params=[];
    if (search) {
      where.push(`(${allowedFields.map(()=>`CAST(?? AS CHAR) LIKE ?`).join(' OR ')})`);
      // safer: use hardcoded field list
      const clauses = allowedFields.map(f=>`CAST(${f} AS CHAR) LIKE ?`);
      where.length=0; where.push(`(${clauses.join(' OR ')})`);
      allowedFields.forEach(()=>params.push(`%${search}%`));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return { isPag, page, limit, search, sortBy, sortOrder, whereSql, params };
  };

  return {
    async getAll(req,res,next) {
      try {
        const {isPag,page,limit,search,sortBy,sortOrder,whereSql,params}=buildList(req.query);
        if (!isPag) { const rows=await baseModel.findAll(tableName,sortBy,sortOrder,whereSql,params); return res.json(rows); }
        const offset=(page-1)*limit;
        const [rows]=await pool.query(`SELECT * FROM ${tableName} ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,[...params,limit,offset]);
        const [cnt]=await pool.query(`SELECT COUNT(*) AS total FROM ${tableName} ${whereSql}`,params);
        const total=cnt[0].total;
        res.json({ data:rows, pagination:{ page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit)),search,sortBy,sortOrder:sortOrder.toLowerCase() } });
      } catch(e) { next(e); }
    },
    async getById(req,res,next) {
      try {
        const id=Number(req.params.id);
        if (!Number.isInteger(id)||id<=0) { res.status(400); return next(new Error('Invalid ID')); }
        const row=await baseModel.findById(tableName,idColumn,id);
        if (!row) { res.status(404); return next(new Error(`${tableName} record not found`)); }
        res.json(row);
      } catch(e) { next(e); }
    },
    async create(req,res,next) {
      try {
        const data=pick(req.body);
        const err=validate(data);
        if (err) { res.status(422); return next(new Error(err)); }
        const id=await baseModel.create(tableName,data);
        const created=await baseModel.findById(tableName,idColumn,id);
        res.status(201).json(created);
      } catch(e) {
        if (e.code==='ER_DUP_ENTRY') { res.status(409); return next(new Error('A record with this value already exists')); }
        next(e);
      }
    },
    async update(req,res,next) {
      try {
        const id=Number(req.params.id);
        if (!Number.isInteger(id)||id<=0) { res.status(400); return next(new Error('Invalid ID')); }
        const data=pick(req.body);
        const err=validate(data,true);
        if (err) { res.status(422); return next(new Error(err)); }
        const aff=await baseModel.update(tableName,idColumn,id,data);
        if (!aff) { res.status(404); return next(new Error(`${tableName} record not found`)); }
        const updated=await baseModel.findById(tableName,idColumn,id);
        res.json(updated);
      } catch(e) {
        if (e.code==='ER_DUP_ENTRY') { res.status(409); return next(new Error('A record with this value already exists')); }
        next(e);
      }
    },
    async remove(req,res,next) {
      try {
        const id=Number(req.params.id);
        if (!Number.isInteger(id)||id<=0) { res.status(400); return next(new Error('Invalid ID')); }
        const aff=await baseModel.remove(tableName,idColumn,id);
        if (!aff) { res.status(404); return next(new Error(`${tableName} record not found`)); }
        res.json({ message:'Record deleted successfully' });
      } catch(e) {
        if (e.code==='ER_ROW_IS_REFERENCED_2') { res.status(409); return next(new Error('Cannot delete: this record is referenced by other data')); }
        next(e);
      }
    }
  };
}

module.exports = makeResourceController;

const pool = require('../config/db');

async function findAll(tableName, orderBy, sortOrder = 'DESC', whereSql = '', params = []) {
  const [rows] = await pool.query(
    `SELECT * FROM ${tableName} ${whereSql} ORDER BY ${orderBy} ${sortOrder}`,
    params
  );
  return rows;
}

async function findById(tableName, idColumn, id) {
  const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE ${idColumn} = ?`, [id]);
  return rows[0];
}

async function create(tableName, data) {
  const [result] = await pool.query(`INSERT INTO ${tableName} SET ?`, [data]);
  return result.insertId;
}

async function update(tableName, idColumn, id, data) {
  const [result] = await pool.query(`UPDATE ${tableName} SET ? WHERE ${idColumn} = ?`, [data, id]);
  return result.affectedRows;
}

async function remove(tableName, idColumn, id) {
  const [result] = await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [id]);
  return result.affectedRows;
}

module.exports = { findAll, findById, create, update, remove };


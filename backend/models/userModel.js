const pool = require('../config/db');

async function createUser(user) {
  const [result] = await pool.query('INSERT INTO users SET ?', [user]);
  return result.insertId;
}

async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

module.exports = { createUser, findUserByEmail };


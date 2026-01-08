// service
const pool = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function createUser({ name, phone, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const query = `
    INSERT INTO users (name, phone, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, phone, email, role;
  `;

  const values = [name, phone, email, passwordHash, role || 'buyer'];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function loginUser(phone, password) {
  const query = `SELECT * FROM users WHERE phone = $1`;
  const { rows } = await pool.query(query, [phone]);

  if (rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new Error('Invalid credentials');
  }

  return user;
}

module.exports = {
  createUser,
  loginUser,
};


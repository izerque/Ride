// controller
const jwt = require('jsonwebtoken');
const authService = require('./auth.service');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_EXPIRES_IN = '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function register(req, res) {
  try {
    const user = await authService.createUser(req.body);
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { phone, password } = req.body;
    const user = await authService.loginUser(phone, password);
    const token = generateToken(user);

    res.json({ user, token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

module.exports = {
  register,
  login,
};


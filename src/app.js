const express = require('express');
const authRoutes = require('./auth/auth.routes');

const app = express();


app.use(express.json());

app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;

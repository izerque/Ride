const express = require('express');
const authRoutes = require('./auth/auth.routes');
const carsRoutes = require('./cars/cars.routes');
const auctionsRoutes = require('./auctions/auctions.routes');
const bidsRoutes = require('./bids/bids.routes');

const app = express();

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/cars', carsRoutes);
app.use('/auctions', auctionsRoutes);
app.use('/bids', bidsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;

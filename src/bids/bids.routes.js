const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const bidsController = require('./bids.controller');

router.post('/', requireAuth, requireRole('buyer'), bidsController.placeBid);

module.exports = router;

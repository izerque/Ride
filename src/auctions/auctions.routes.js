const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const auctionsController = require('./auctions.controller');

router.post('/', requireAuth, requireRole('seller'), auctionsController.createAuction);
router.get('/', auctionsController.getAllAuctions);
router.get('/:id', auctionsController.getAuctionById);

module.exports = router;

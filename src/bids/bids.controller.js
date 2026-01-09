const bidsService = require('./bids.service');

async function placeBid(req, res) {
  try {
    const { auction_id, amount } = req.body;
    
    if (!auction_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields: auction_id, amount' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Bid amount must be greater than 0' });
    }
    
    const auction = await bidsService.getAuctionById(auction_id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    const state = bidsService.computeAuctionState(auction.start_time, auction.end_time);
    if (state !== 'live') {
      return res.status(400).json({ error: `Auction is not live. Current state: ${state}` });
    }
    
    if (auction.seller_id === req.user.id) {
      return res.status(403).json({ error: 'Seller cannot bid on their own auction' });
    }
    
    const highestBid = await bidsService.getHighestBid(auction_id);
    const minimumBid = highestBid || parseFloat(auction.starting_price);
    
    if (amount <= minimumBid) {
      return res.status(400).json({ 
        error: `Bid must be greater than ${minimumBid}. Current highest bid: ${highestBid || 'none (starting price)'}` 
      });
    }
    
    const bid = await bidsService.createBid({
      auctionId: auction_id,
      bidderId: req.user.id,
      amount,
    });
    
    res.status(201).json(bid);
  } catch (error) {
    console.error('Error placing bid:', error);
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Auction or user not found' });
    }
    res.status(500).json({ error: 'Failed to place bid' });
  }
}

module.exports = {
  placeBid,
};

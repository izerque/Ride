const pool = require('../db');

async function createBid({ auctionId, bidderId, amount }) {
  const query = `
    INSERT INTO bids (auction_id, bidder_id, amount)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  
  const values = [auctionId, bidderId, amount];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function getAuctionById(auctionId) {
  const query = `
    SELECT 
      a.*,
      c.seller_id,
      c.starting_price
    FROM auctions a
    JOIN cars c ON a.car_id = c.id
    WHERE a.id = $1;
  `;
  
  const { rows } = await pool.query(query, [auctionId]);
  return rows[0];
}

function computeAuctionState(startTime, endTime) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (now < start) {
    return 'upcoming';
  } else if (now >= start && now <= end) {
    return 'live';
  } else {
    return 'ended';
  }
}

async function getHighestBid(auctionId) {
  const query = `
    SELECT amount
    FROM bids
    WHERE auction_id = $1
    ORDER BY amount DESC
    LIMIT 1;
  `;
  
  const { rows } = await pool.query(query, [auctionId]);
  return rows[0]?.amount || null;
}

module.exports = {
  createBid,
  getAuctionById,
  computeAuctionState,
  getHighestBid,
};

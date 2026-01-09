const pool = require('../db');

async function createAuction({ carId, startTime, endTime, reservePrice }) {
  const query = `
    INSERT INTO auctions (car_id, start_time, end_time)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  
  const values = [carId, startTime, endTime];
  const { rows } = await pool.query(query, values);
  
  const auction = rows[0];
  auction.reserve_price = reservePrice;
  return auction;
}

async function getAllAuctions() {
  const query = `
    SELECT 
      a.*,
      c.make,
      c.model,
      c.year,
      c.mileage,
      c.starting_price,
      u.name as seller_name
    FROM auctions a
    JOIN cars c ON a.car_id = c.id
    JOIN users u ON c.seller_id = u.id
    ORDER BY a.start_time DESC;
  `;
  
  const { rows } = await pool.query(query);
  return rows.map(auction => ({
    ...auction,
    reserve_price: auction.reserve_price || auction.starting_price,
    state: computeAuctionState(auction.start_time, auction.end_time),
  }));
}

async function getAuctionById(id) {
  const query = `
    SELECT 
      a.*,
      c.make,
      c.model,
      c.year,
      c.mileage,
      c.starting_price,
      c.seller_id,
      u.name as seller_name
    FROM auctions a
    JOIN cars c ON a.car_id = c.id
    JOIN users u ON c.seller_id = u.id
    WHERE a.id = $1;
  `;
  
  const { rows } = await pool.query(query, [id]);
  if (rows.length === 0) return null;
  
  const auction = rows[0];
  return {
    ...auction,
    reserve_price: auction.reserve_price || auction.starting_price,
    state: computeAuctionState(auction.start_time, auction.end_time),
  };
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

async function getCarOwner(carId) {
  const query = `
    SELECT seller_id FROM cars WHERE id = $1;
  `;
  
  const { rows } = await pool.query(query, [carId]);
  return rows[0]?.seller_id;
}

async function getCarStartingPrice(carId) {
  const query = `
    SELECT starting_price FROM cars WHERE id = $1;
  `;
  
  const { rows } = await pool.query(query, [carId]);
  return rows[0]?.starting_price;
}

async function checkExistingAuctionForCar(carId) {
  const query = `
    SELECT id, start_time, end_time
    FROM auctions
    WHERE car_id = $1
    AND (
      (start_time <= NOW() AND end_time >= NOW())
      OR (start_time > NOW())
    );
  `;
  
  const { rows } = await pool.query(query, [carId]);
  return rows;
}

async function checkOverlappingAuctions(carId, startTime, endTime) {
  const query = `
    SELECT id
    FROM auctions
    WHERE car_id = $1
    AND (
      (start_time <= $2 AND end_time >= $2)
      OR (start_time <= $3 AND end_time >= $3)
      OR (start_time >= $2 AND end_time <= $3)
    );
  `;
  
  const { rows } = await pool.query(query, [carId, startTime, endTime]);
  return rows;
}

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
  computeAuctionState,
  getCarOwner,
  getCarStartingPrice,
  checkExistingAuctionForCar,
  checkOverlappingAuctions,
};

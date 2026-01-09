const pool = require('../db');

async function createCar({ sellerId, make, model, year, mileage, startingPrice }) {
  const query = `
    INSERT INTO cars (seller_id, make, model, year, mileage, starting_price)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  
  const values = [sellerId, make, model, year, mileage, startingPrice];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function getAllCars() {
  const query = `
    SELECT c.*, u.name as seller_name, u.phone as seller_phone
    FROM cars c
    LEFT JOIN users u ON c.seller_id = u.id
    ORDER BY c.created_at DESC;
  `;
  
  const { rows } = await pool.query(query);
  return rows;
}

async function getCarById(id) {
  const query = `
    SELECT c.*, u.name as seller_name, u.phone as seller_phone
    FROM cars c
    LEFT JOIN users u ON c.seller_id = u.id
    WHERE c.id = $1;
  `;
  
  const { rows } = await pool.query(query, [id]);
  return rows[0];
}

async function updateCar(id, { make, model, year, mileage, startingPrice }) {
  const query = `
    UPDATE cars
    SET make = COALESCE($1, make),
        model = COALESCE($2, model),
        year = COALESCE($3, year),
        mileage = COALESCE($4, mileage),
        starting_price = COALESCE($5, starting_price)
    WHERE id = $6
    RETURNING *;
  `;
  
  const values = [make, model, year, mileage, startingPrice, id];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function deleteCar(id) {
  const query = `
    DELETE FROM cars
    WHERE id = $1
    RETURNING id;
  `;
  
  const { rows } = await pool.query(query, [id]);
  return rows[0];
}

async function getCarOwner(carId) {
  const query = `
    SELECT seller_id FROM cars WHERE id = $1;
  `;
  
  const { rows } = await pool.query(query, [carId]);
  return rows[0]?.seller_id;
}

module.exports = {
  createCar,
  getAllCars,
  getCarById,
  updateCar,
  deleteCar,
  getCarOwner,
};

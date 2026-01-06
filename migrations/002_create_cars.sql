CREATE TABLE cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  make VARCHAR(50),
  model VARCHAR(50),
  year INT,
  mileage INT,
  starting_price NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

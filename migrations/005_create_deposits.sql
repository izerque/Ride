CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'refunded')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

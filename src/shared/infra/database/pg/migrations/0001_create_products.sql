CREATE TABLE IF NOT EXISTS products (
  product_code VARCHAR(50) PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  pick_location VARCHAR(20) NOT NULL
);

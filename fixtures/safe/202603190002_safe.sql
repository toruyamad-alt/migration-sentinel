ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';

UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL;

ALTER TABLE users ALTER COLUMN timezone SET NOT NULL;

CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at);

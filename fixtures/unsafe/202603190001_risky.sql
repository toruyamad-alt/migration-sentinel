ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL;

CREATE INDEX idx_orders_created_at ON orders(created_at);

ALTER TABLE subscriptions RENAME COLUMN state TO status;

DELETE FROM audit_logs;

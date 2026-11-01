-- Add expires_at column to address table for mailbox lifetime countdown.
-- New addresses get expires_at = now + ttl seconds, where ttl comes from the
-- create request (validated against ADDRESS_TTL_OPTIONS) or DEFAULT_ADDRESS_TTL.
-- NULL means the address never expires.

ALTER TABLE address ADD COLUMN expires_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_address_expires_at ON address(expires_at);

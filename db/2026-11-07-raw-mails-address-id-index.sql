-- Composite index for inbox listing: WHERE address = ? ORDER BY id DESC.
-- Without it SQLite filters via idx_raw_mails_address and then sorts the result.

CREATE INDEX IF NOT EXISTS idx_raw_mails_address_id ON raw_mails(address, id);

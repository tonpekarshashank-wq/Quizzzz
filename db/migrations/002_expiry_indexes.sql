CREATE INDEX IF NOT EXISTS rate_buckets_expiry ON rate_buckets(resets_at);
CREATE INDEX IF NOT EXISTS reset_tokens_expiry ON reset_tokens(expires_at);

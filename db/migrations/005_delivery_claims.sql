ALTER TABLE live_outbox ADD COLUMN claimed_until timestamptz;
CREATE INDEX outbox_pending ON live_outbox(created_at) WHERE delivered_at IS NULL;
CREATE INDEX job_due ON scheduled_jobs(due_at) WHERE completed_at IS NULL;

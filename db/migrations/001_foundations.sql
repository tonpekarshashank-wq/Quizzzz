CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, full_name varchar(100) NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS host_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS host_sessions_expiry ON host_sessions(expires_at);
CREATE TABLE IF NOT EXISTS reset_tokens (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quizzes (
 id uuid PRIMARY KEY, host_id uuid NOT NULL REFERENCES users(id),
 draft jsonb NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quizzes_owner ON quizzes(host_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS rate_buckets (
 key text PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL
);

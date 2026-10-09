ALTER TABLE quiz_sessions ADD COLUMN final_summary jsonb;
CREATE TABLE player_ratings (
 session_id uuid NOT NULL REFERENCES quiz_sessions(id), participant_id uuid PRIMARY KEY REFERENCES participants(id),
 value integer NOT NULL CHECK(value BETWEEN 1 AND 5), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,participant_id) REFERENCES participants(session_id,id)
);
CREATE INDEX session_history ON quiz_sessions(host_id,ended_at DESC) WHERE ended_at IS NOT NULL;

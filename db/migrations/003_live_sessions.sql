CREATE TABLE quiz_sessions (
 id uuid PRIMARY KEY, host_id uuid NOT NULL REFERENCES users(id), quiz_id uuid NOT NULL REFERENCES quizzes(id),
 title varchar(120) NOT NULL, pin char(6) NOT NULL CHECK(pin ~ '^[0-9]{6}$'),
 state text NOT NULL DEFAULT 'LOBBY' CHECK(state IN ('LOBBY','QUESTION_ACTIVE','RESULT_REVEAL','LEADERBOARD','COMPLETED','CANCELLED','INTERRUPTED')),
 revision integer NOT NULL DEFAULT 1, current_index integer NOT NULL DEFAULT 0, capacity integer NOT NULL CHECK(capacity>0),
 scope_version integer NOT NULL DEFAULT 0, roster_count integer NOT NULL DEFAULT 0, theme text NOT NULL DEFAULT 'summit',
 controller_id uuid, control_generation integer NOT NULL DEFAULT 0, control_expires_at timestamptz,
 host_last_seen_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 create_key uuid NOT NULL, create_fingerprint text NOT NULL, UNIQUE(host_id,create_key)
);
CREATE UNIQUE INDEX live_pin ON quiz_sessions(pin) WHERE state IN ('LOBBY','QUESTION_ACTIVE','RESULT_REVEAL','LEADERBOARD');
CREATE TABLE session_questions (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES quiz_sessions(id), question_index integer NOT NULL,
 prompt varchar(250) NOT NULL, type text NOT NULL, time_limit integer NOT NULL, base_points integer NOT NULL,
 correct_option_id uuid NOT NULL, starts_at timestamptz, ends_at timestamptz, closed_at timestamptz,
 UNIQUE(session_id,question_index), UNIQUE(session_id,id)
);
CREATE TABLE session_options (
 id uuid PRIMARY KEY, session_id uuid NOT NULL, question_id uuid NOT NULL, label varchar(150) NOT NULL, option_index integer NOT NULL,
 FOREIGN KEY(session_id,question_id) REFERENCES session_questions(session_id,id), UNIQUE(question_id,id), UNIQUE(question_id,option_index)
);
ALTER TABLE session_questions ADD CONSTRAINT correct_membership FOREIGN KEY(id,correct_option_id) REFERENCES session_options(question_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE participants (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES quiz_sessions(id), nickname varchar(25) NOT NULL,
 nickname_key text NOT NULL, avatar_body integer NOT NULL CHECK(avatar_body BETWEEN 0 AND 5), avatar_mood text NOT NULL CHECK(avatar_mood IN ('smile','grin','o')),
 token_hash text NOT NULL UNIQUE, revoked boolean NOT NULL DEFAULT false, joined_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(), score integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0, best_streak integer NOT NULL DEFAULT 0,
 UNIQUE(session_id,nickname_key), UNIQUE(session_id,id)
);
CREATE TABLE join_receipts (
 request_id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES quiz_sessions(id), participant_id uuid NOT NULL REFERENCES participants(id), fingerprint text NOT NULL
);
CREATE TABLE responses (
 id uuid PRIMARY KEY, session_id uuid NOT NULL, participant_id uuid NOT NULL, question_id uuid NOT NULL, selected_option_id uuid NOT NULL,
 submission_id uuid NOT NULL, received_at timestamptz NOT NULL, response_ms integer NOT NULL, correct boolean NOT NULL, points integer NOT NULL,
 FOREIGN KEY(session_id,participant_id) REFERENCES participants(session_id,id),
 FOREIGN KEY(session_id,question_id) REFERENCES session_questions(session_id,id),
 FOREIGN KEY(question_id,selected_option_id) REFERENCES session_options(question_id,id),
 UNIQUE(participant_id,question_id), UNIQUE(participant_id,submission_id)
);
CREATE TABLE question_results (
 session_id uuid NOT NULL, question_id uuid NOT NULL, participant_id uuid NOT NULL,
 result jsonb NOT NULL, PRIMARY KEY(question_id,participant_id),
 FOREIGN KEY(session_id,participant_id) REFERENCES participants(session_id,id), FOREIGN KEY(session_id,question_id) REFERENCES session_questions(session_id,id)
);
CREATE TABLE command_receipts (
 session_id uuid NOT NULL REFERENCES quiz_sessions(id), command_id uuid NOT NULL, fingerprint text NOT NULL, outcome jsonb NOT NULL,
 PRIMARY KEY(session_id,command_id)
);
CREATE TABLE live_outbox (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES quiz_sessions(id), event text NOT NULL, revision integer NOT NULL, scope_version integer NOT NULL DEFAULT 0,
 delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_outbox_pending ON live_outbox(created_at) WHERE delivered_at IS NULL;
CREATE TABLE scheduled_jobs (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES quiz_sessions(id), due_at timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN ('deadline','inactivity')), scheduled_at timestamptz, completed_at timestamptz,
 claimed_until timestamptz
);
CREATE INDEX scheduled_jobs_pending ON scheduled_jobs(due_at) WHERE completed_at IS NULL;

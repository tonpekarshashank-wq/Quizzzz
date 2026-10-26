ALTER TABLE session_questions ADD COLUMN reveal_fact varchar(160);
ALTER TABLE quiz_sessions ADD COLUMN intro_ends_at timestamptz;
ALTER TABLE quiz_sessions DROP CONSTRAINT quiz_sessions_state_check;
ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_state_check CHECK(state IN ('LOBBY','QUESTION_INTRO','QUESTION_ACTIVE','RESULT_REVEAL','LEADERBOARD','COMPLETED','CANCELLED','INTERRUPTED'));
DROP INDEX live_pin;
CREATE UNIQUE INDEX live_pin ON quiz_sessions(pin) WHERE state IN ('LOBBY','QUESTION_INTRO','QUESTION_ACTIVE','RESULT_REVEAL','LEADERBOARD');
ALTER TABLE scheduled_jobs DROP CONSTRAINT scheduled_jobs_kind_check;
ALTER TABLE scheduled_jobs ADD CONSTRAINT scheduled_jobs_kind_check CHECK(kind IN ('deadline','inactivity','intro'));
-- Curated reveal-only facts; do not modify previously applied migrations.
UPDATE question_ideas AS idea SET content=jsonb_set(idea.content,'{revealFact}',to_jsonb(facts.fact))
FROM (VALUES
('science-mercury','Mercury is the innermost planet in our solar system.'),
('science-star','The Sun produces energy through nuclear fusion in its core.'),
('science-symbol','The symbol Au comes from the Latin word aurum, meaning gold.'),
('science-water','Each water molecule contains two hydrogen atoms and one oxygen atom.'),
('science-gravity','Gravity keeps the Moon in orbit around Earth.'),
('science-mammals','Whales breathe air and feed their young with milk.'),
('tech-cpu','A CPU executes instructions that help a computer run programs.'),
('tech-binary','A binary digit is called a bit.'),
('tech-keyboard','Keyboard shortcuts can perform actions without using a mouse.'),
('tech-browser','A browser turns website code into the pages you see on screen.'),
('tech-backup','Keeping a separate backup helps you recover from accidental deletion.'),
('tech-byte','Eight bits can represent 256 different combinations.'),
('geography-ocean','The Pacific Ocean covers more area than any other ocean.'),
('geography-capital','Tokyo is on Honshu, the largest of the main Japanese islands.'),
('geography-equator','The Equator is at zero degrees latitude.'),
('geography-continent','Asia is the largest continent by both land area and population.'),
('geography-south','The South Pole lies on the Antarctic continent.'),
('geography-atlantic','The Atlantic separates the Americas from Europe and Africa.'),
('safety-password','A unique password helps keep one breached account from exposing your other accounts.'),
('safety-phishing','Phishing messages often create urgency to pressure you into acting quickly.'),
('safety-lock','Locking your screen helps prevent someone nearby from accessing your open session.'),
('safety-code','A one-time code can grant account access, so treat it like a password.'),
('safety-recipient','Checking recipients before sending helps prevent accidental disclosure.'),
('safety-update','Security updates can fix weaknesses in software.'),
('general-week','A week contains seven days, or 168 hours.'),
('general-triangle','The interior angles of a triangle on a flat plane add up to 180 degrees.'),
('general-hours','A 24-hour day contains 1,440 minutes.'),
('general-dozen','A dozen is a group of twelve items.'),
('general-even','Zero is an even integer because it is divisible by two without a remainder.'),
('general-months','A calendar year contains twelve months.')
) AS facts(id,fact) WHERE idea.id=facts.id;

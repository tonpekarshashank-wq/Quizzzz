ALTER TABLE question_ideas DROP CONSTRAINT question_ideas_category_check;
ALTER TABLE question_ideas ADD CONSTRAINT question_ideas_category_check
  CHECK (category IN ('Science','Tech','Geography','Work safety','General','Sports'));

-- Append the two reviewed sports ideas after existing library records.
WITH base AS (SELECT coalesce(max(sort_order),0) AS last_order FROM question_ideas)
INSERT INTO question_ideas(id,category,sort_order,content)
SELECT seed.id,'Sports',base.last_order+seed.offset_order,seed.content
FROM base CROSS JOIN (VALUES
 ('sports-cricket-hat-trick',1,'{"kind":"mc","prompt":"In cricket, what is a hat-trick?","timeSeconds":20,"points":1000,"options":["Three boundaries in one over","Three wickets taken by a bowler on consecutive deliveries","Three catches in a match","Three maiden overs"],"correctIndex":1,"revealFact":"A bowling hat-trick can span different overs."}'::jsonb),
 ('sports-tennis-love',2,'{"kind":"mc","prompt":"In tennis, what word means a score of zero?","timeSeconds":20,"points":1000,"options":["Deuce","Advantage","Love","Let"],"correctIndex":2,"revealFact":"A score of 15–0 is called fifteen-love."}'::jsonb)
) AS seed(id,offset_order,content);

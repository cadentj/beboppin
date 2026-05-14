ALTER TABLE links ADD COLUMN content TEXT;

UPDATE links
SET content = url
WHERE content IS NULL;

INSERT INTO links (url, tag, created_at, content)
SELECT '', NULL, created_at, content
FROM thoughts;

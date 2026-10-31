ALTER TABLE booths
    ADD COLUMN image_url TEXT;

ALTER TABLE booths
    ADD CONSTRAINT ck_booths_image_url
        CHECK (
            image_url IS NULL
            OR (
                image_url = BTRIM(image_url)
                AND CHAR_LENGTH(image_url) BETWEEN 1 AND 2048
            )
        );

UPDATE booths b
SET image_url = CASE UPPER(BTRIM(l.code))
    WHEN 'A01' THEN '/images/booths/a01-vietnamese-literature.png'
    WHEN 'A02' THEN '/images/booths/a02-children-books.png'
    WHEN 'A03' THEN '/images/booths/a03-world-books.png'
    WHEN 'A04' THEN '/images/booths/a04-history-culture.png'
    WHEN 'A05' THEN '/images/booths/a05-education-skills.png'
    WHEN 'B01' THEN '/images/booths/b01-art-design.png'
    WHEN 'B02' THEN '/images/booths/b02-manga-comics.png'
    WHEN 'B03' THEN '/images/booths/b03-lifestyle.png'
    WHEN 'B04' THEN '/images/booths/b04-stem-technology.png'
    WHEN 'B05' THEN '/images/booths/b05-book-cafe.png'
    ELSE b.image_url
END
FROM locations l
WHERE l.location_id = b.booth_id
  AND UPPER(BTRIM(l.code)) IN (
      'A01', 'A02', 'A03', 'A04', 'A05',
      'B01', 'B02', 'B03', 'B04', 'B05'
  );

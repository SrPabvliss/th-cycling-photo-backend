-- Drop view that depends on photo_bibs.status
DROP VIEW IF EXISTS photo_bib_effective;

-- Rename old type
ALTER TYPE "BibReadingStatus" RENAME TO "BibReadingStatus_old";

-- Create new enum with reduced values
CREATE TYPE "BibReadingStatus" AS ENUM ('read', 'abstained');

-- Migrate column data, mapping old values to new enum
ALTER TABLE "photo_bibs"
  ALTER COLUMN "status" TYPE "BibReadingStatus"
  USING (
    CASE "status"::text
      WHEN 'matched'   THEN 'read'::"BibReadingStatus"
      WHEN 'unmatched' THEN 'read'::"BibReadingStatus"
      WHEN 'abstained' THEN 'abstained'::"BibReadingStatus"
    END
  );

-- Drop old type
DROP TYPE "BibReadingStatus_old";

-- Recreate view with new enum status type
CREATE VIEW photo_bib_effective AS
SELECT
  b.id,
  b.photo_id,
  b.source,
  b.digits AS digits_original,
  COALESCE(c_digits.new_value, b.digits) AS digits_effective,
  (c_digits.id IS NOT NULL) AS digits_was_corrected,
  c_digits.corrected_at AS digits_corrected_at,
  c_digits.reviewer_id AS digits_corrected_by,
  b.confidence,
  b.status AS status_original,
  b.raw_ocr_text,
  b.bbox_source,
  b.created_at
FROM photo_bibs b
LEFT JOIN LATERAL (
  SELECT id, new_value, corrected_at, reviewer_id
  FROM corrections
  WHERE target_type = 'photo_bib' AND target_id = b.id AND field = 'digits'
  ORDER BY corrected_at DESC
  LIMIT 1
) c_digits ON TRUE;

-- Replace legacy JSON-in-text evidence with database-validated JSONB arrays.
-- Invalid or non-array historical values fail closed to an empty evidence set;
-- the API completion gate refuses an empty checklist, so damaged history can
-- never be mistaken for completed work.

CREATE OR REPLACE FUNCTION pg_temp.rah_cleaning_json_array(value TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed JSONB;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    parsed := value::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN '[]'::JSONB;
  END;

  IF jsonb_typeof(parsed) <> 'array' THEN
    RETURN '[]'::JSONB;
  END IF;
  RETURN parsed;
END;
$$;

ALTER TABLE "CleaningJob"
  ALTER COLUMN "checklistProgress" TYPE JSONB
    USING pg_temp.rah_cleaning_json_array("checklistProgress"),
  ALTER COLUMN "photos" TYPE JSONB
    USING pg_temp.rah_cleaning_json_array("photos"),
  ALTER COLUMN "issues" TYPE JSONB
    USING pg_temp.rah_cleaning_json_array("issues");

ALTER TABLE "CleaningJob"
  ADD CONSTRAINT "CleaningJob_checklistProgress_array_check"
    CHECK ("checklistProgress" IS NULL OR jsonb_typeof("checklistProgress") = 'array'),
  ADD CONSTRAINT "CleaningJob_photos_array_check"
    CHECK ("photos" IS NULL OR jsonb_typeof("photos") = 'array'),
  ADD CONSTRAINT "CleaningJob_issues_array_check"
    CHECK ("issues" IS NULL OR jsonb_typeof("issues") = 'array');

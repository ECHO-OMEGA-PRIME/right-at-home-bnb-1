-- Join public marketing slugs to the canonical Property ids through VRBO's
-- stable listing id. This makes every API response and operational foreign key
-- share one identity while preserving human-readable public URLs.
WITH mapping("slug", "vrboId") AS (
  VALUES
    ('castleford-5001', '2636389'),
    ('Golf-Course-3209', '3005111'),
    ('garfield-2702', '2634718'),
    ('douglas-2000', '3355618'),
    ('Dentcrest-4707', '2638481'),
    ('chelsea-3210', '2643784'),
    ('storey-4801', '2643822'),
    ('Daventry-1309', '4750070'),
    ('santiago-dreams-1311', '4179271'),
    ('lincoln-green-5055', '4581977'),
    ('shandon-3528', '4894280'),
    ('monterrey-1605', '3477668'),
    ('Gleneagles-4735', '2643808'),
    ('outdoor-dream-3106', '4700881'),
    ('posh-private-1426', '4437486'),
    ('Siesta-4217', '4135262'),
    ('Mogford-1408', '3724481'),
    ('blazing-saddle-2501', '5103283'),
    ('haynes-2802', '2638524'),
    ('Vanguard-6613', '3559249'),
    ('Oriole-6100', '4471713'),
    ('gleneagles-4533', '4056016')
)
UPDATE "Property" AS property
SET "slug" = mapping."slug", "updatedAt" = CURRENT_TIMESTAMP
FROM mapping
WHERE property."vrboId" = mapping."vrboId"
  AND property."slug" IS DISTINCT FROM mapping."slug";

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "Property"
  WHERE "status" = 'ACTIVE' AND "slug" IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION '% active properties are missing a public slug after backfill', missing_count;
  END IF;
END $$;

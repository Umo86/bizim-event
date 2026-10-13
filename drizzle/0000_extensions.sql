-- Extensions required by Bizim Event (all available on Neon's free plan).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- unaccent() is STABLE, so it can't be used in generated columns or indexes.
-- This wrapper pins the dictionary, which makes it safe to declare IMMUTABLE.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint
-- drizzle-kit quotes custom type names, so geography(Point, 4326) is exposed as a domain.
DO $$ BEGIN
  CREATE DOMAIN public.geo_point AS geography(Point, 4326);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

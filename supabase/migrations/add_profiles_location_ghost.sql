-- User location & ghost mode for map "social radar"
-- Run this in Supabase Dashboard -> SQL Editor if not using Supabase CLI.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_ghost') THEN
    ALTER TABLE public.profiles ADD COLUMN is_ghost boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'latitude') THEN
    ALTER TABLE public.profiles ADD COLUMN latitude double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'longitude') THEN
    ALTER TABLE public.profiles ADD COLUMN longitude double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen timestamptz DEFAULT now();
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.is_ghost IS 'When true, user is hidden from map (ghost mode)';
COMMENT ON COLUMN public.profiles.latitude IS 'Last known latitude for map';
COMMENT ON COLUMN public.profiles.longitude IS 'Last known longitude for map';
COMMENT ON COLUMN public.profiles.last_seen IS 'Last time location was updated (active in last 24h = visible)';

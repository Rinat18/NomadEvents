-- Add privacy column to profiles if missing (for ghost mode, location, check-ins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'privacy'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN privacy jsonb DEFAULT '{"ghostMode": false, "showExactLocation": false, "allowCheckIns": true}'::jsonb;
    COMMENT ON COLUMN public.profiles.privacy IS 'User privacy: ghostMode, showExactLocation, allowCheckIns';
  END IF;
END $$;

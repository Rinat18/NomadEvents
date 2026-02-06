-- Allow event creator to UPDATE their event (fix "no rows updated" when using anon or missing policy).
-- Run in Supabase Dashboard > SQL Editor if update still fails.

-- Drop existing policy if it exists (so we can recreate with anon + authenticated)
DROP POLICY IF EXISTS "events_update_own" ON public.events;

-- Creator can update own event (both anon and authenticated, using auth.uid() = creator_id)
CREATE POLICY "events_update_own"
ON public.events FOR UPDATE
TO anon, authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

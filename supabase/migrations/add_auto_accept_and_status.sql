-- ==============================================
-- Migration: Add auto_accept and status for Face Control
-- Supabase Dashboard → SQL Editor → вставь и нажми Run
-- ==============================================

-- 1. Добавить auto_accept в events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS auto_accept boolean NOT NULL DEFAULT true;

-- 2. Добавить status в event_participants
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Ограничение для status (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_status_check'
  ) THEN
    ALTER TABLE public.event_participants
    ADD CONSTRAINT event_participants_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 3. Политика: создатель может обновлять status (approve/reject)
DROP POLICY IF EXISTS "participants_update_creator" ON public.event_participants;
CREATE POLICY "participants_update_creator"
ON public.event_participants FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_participants.event_id AND e.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_participants.event_id AND e.creator_id = auth.uid()
  )
);

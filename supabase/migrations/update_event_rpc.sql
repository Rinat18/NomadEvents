-- RPC to update event as creator (bypasses RLS; checks auth.uid() = creator_id inside).
-- Run in Supabase Dashboard > SQL Editor. Fixes "no rows updated" when RLS blocks UPDATE.

-- Ensure column exists (skip if already run add_event_cover_image.sql)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE OR REPLACE FUNCTION public.update_event_by_creator(
  p_event_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_cover_image_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT creator_id INTO v_creator_id FROM public.events WHERE id = p_event_id;
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;
  IF auth.uid() IS NULL OR auth.uid() != v_creator_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_creator');
  END IF;

  UPDATE public.events
  SET
    title = COALESCE(NULLIF(trim(p_title), ''), title),
    description = CASE WHEN p_description IS NULL THEN description ELSE NULLIF(trim(p_description), '') END,
    cover_image_url = CASE WHEN p_cover_image_url IS NULL THEN cover_image_url ELSE NULLIF(trim(p_cover_image_url), '') END
  WHERE id = p_event_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_by_creator(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_event_by_creator(uuid, text, text, text) TO authenticated;

-- Add optional cover image URL to events (for inline editing in Details modal).
-- Ensure Storage bucket "event-images" exists in Supabase Dashboard (Storage -> New bucket -> event-images, Public).

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cover_image_url text;

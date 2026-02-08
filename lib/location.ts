import { getProfile } from '@/lib/local-profile';
import { supabase } from '@/lib/supabase';

/**
 * Update current user's location in the DB for the map "social radar".
 * - If Ghost Mode is ON: only update last_seen (do not store lat/lng, or set them to null).
 * - If Ghost Mode is OFF: update latitude, longitude, and last_seen.
 */
export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await getProfile();
  const isGhost = profile.is_ghost === true;

  const updates: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
  };
  if (isGhost) {
    updates.latitude = null;
    updates.longitude = null;
  } else {
    updates.latitude = lat;
    updates.longitude = lng;
  }

  await supabase.from('profiles').update(updates).eq('id', user.id);
}

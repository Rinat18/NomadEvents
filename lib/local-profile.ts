import { supabase } from './supabase';

export type VibeIntent = 'just-coffee' | 'networking' | 'romantic-date' | 'language-practice' | 'friendship' | 'adventure';

export type FavoriteSpot = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type PrivacySettings = {
  ghostMode: boolean; // Hide visibility on map
  showExactLocation: boolean; // Show approximate distance only
  allowCheckIns: boolean; // Allow check-ins at venues
};

export type LocalProfile = {
  id: string;
  name: string;
  bio: string | null;
  photos: string[]; // Array of photo URLs
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  languages: string[]; // ['ru', 'en', 'ky']
  interests: string[]; // ['travel', 'food', 'sports', ...]
  vibeIntent: VibeIntent | null; // What they're looking for
  conversationStarters: string[]; // Ice breakers
  favoriteSpots: FavoriteSpot[]; // Favorite places in Bishkek
  privacy: PrivacySettings;
  location: string | null; // 'Bishkek, Kyrgyzstan'
  created_at: string;
  updated_at: string;
  // Map / ghost mode (Supabase: is_ghost, latitude, longitude, last_seen)
  is_ghost: boolean;
  latitude: number | null;
  longitude: number | null;
  last_seen: string | null;
};

/** Minimal profile for map markers (nearby users) */
export type NearbyUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  last_seen: string;
};

// Default profile for new users or fallback
const DEFAULT_PROFILE: LocalProfile = {
  id: 'local-user',
  name: 'Новый пользователь',
  bio: null,
  photos: [],
  age: null,
  gender: null,
  languages: ['ru'],
  interests: [],
  vibeIntent: null,
  conversationStarters: [],
  favoriteSpots: [],
  privacy: {
    ghostMode: false,
    showExactLocation: false,
    allowCheckIns: true,
  },
  location: 'Бишкек, Кыргызстан',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_ghost: false,
  latitude: null,
  longitude: null,
  last_seen: null,
};

/**
 * Get current user's profile from Supabase
 */
export async function getProfile(): Promise<LocalProfile> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[Profile] No user logged in, returning default profile');
      return DEFAULT_PROFILE;
    }

    // Fetch profile from Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[Profile] Error fetching profile:', error.message);
      // Return default with user's ID
      return {
        ...DEFAULT_PROFILE,
        id: user.id,
        name: user.email?.split('@')[0] || 'User',
      };
    }

    // Map Supabase profile (snake_case) to LocalProfile (our app format)
    const profile: LocalProfile = {
      id: data.id,
      name: data.name || 'User',
      bio: data.bio || null,
      photos: data.avatar_url ? [data.avatar_url] : [],
      age: data.age || null,
      gender: data.gender || null,
      languages: data.languages || ['ru'],
      interests: data.interests || [],
      vibeIntent: (data.vibe as VibeIntent) || null,
      conversationStarters: data.conversation_starters || [],
      favoriteSpots: data.favorite_spots || [],
      privacy: data.privacy || {
        ghostMode: false,
        showExactLocation: false,
        allowCheckIns: true,
      },
      location: data.location || 'Бишкек, Кыргызстан',
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      is_ghost: data.is_ghost === true,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      last_seen: data.last_seen ?? null,
    };

    return profile;
  } catch (e) {
    console.error('[Profile] Unexpected error:', e);
    return DEFAULT_PROFILE;
  }
}

/**
 * Create or replace profile row (for mandatory setup after sign-up).
 * Use when profile row may not exist or is incomplete.
 */
export async function upsertProfile(params: {
  name: string;
  avatar_url: string | null;
  vibe?: string | null;
  bio?: string | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      name: params.name.trim(),
      avatar_url: params.avatar_url || null,
      vibe: params.vibe?.trim() || null,
      bio: params.bio?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

/**
 * Update current user's profile in Supabase
 */
export async function updateProfile(
  updates: Partial<Omit<LocalProfile, 'id' | 'created_at'>>
): Promise<LocalProfile> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Map LocalProfile updates to Supabase format (snake_case)
    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) supabaseUpdates.name = updates.name;
    if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;
    if (updates.photos !== undefined && updates.photos.length > 0) {
      supabaseUpdates.avatar_url = updates.photos[0]; // Primary photo
    }
    if (updates.age !== undefined) supabaseUpdates.age = updates.age;
    if (updates.gender !== undefined) supabaseUpdates.gender = updates.gender;
    if (updates.languages !== undefined) supabaseUpdates.languages = updates.languages;
    if (updates.interests !== undefined) supabaseUpdates.interests = updates.interests;
    if (updates.vibeIntent !== undefined) supabaseUpdates.vibe = updates.vibeIntent;
    if (updates.conversationStarters !== undefined) {
      supabaseUpdates.conversation_starters = updates.conversationStarters;
    }
    if (updates.favoriteSpots !== undefined) {
      supabaseUpdates.favorite_spots = updates.favoriteSpots;
    }
    // if (updates.privacy !== undefined) supabaseUpdates.privacy = updates.privacy;
    if (updates.location !== undefined) supabaseUpdates.location = updates.location;
    if (updates.is_ghost !== undefined) supabaseUpdates.is_ghost = updates.is_ghost;
    if (updates.latitude !== undefined) supabaseUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) supabaseUpdates.longitude = updates.longitude;
    if (updates.last_seen !== undefined) supabaseUpdates.last_seen = updates.last_seen;

    // Update in Supabase
    const { error } = await supabase
      .from('profiles')
      .update(supabaseUpdates)
      .eq('id', user.id);

    if (error) {
      console.error('[Profile] Error updating profile:', error.message);
      throw error;
    }

    // Return updated profile
    return await getProfile();
  } catch (e) {
    console.error('[Profile] Update failed:', e);
    throw e;
  }
}

/**
 * Get current user ID (from Supabase auth)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Fetch nearby users for the map (non-ghost, with location, active in last 24h).
 * Excludes the current user.
 */
export async function getNearbyUsers(myUserId: string | null): Promise<NearbyUser[]> {
  if (!myUserId) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, latitude, longitude, last_seen')
    .neq('id', myUserId)
    .eq('is_ghost', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('last_seen', since);

  if (error) {
    console.warn('[Profile] getNearbyUsers error:', error.message);
    return [];
  }
  return (data || [])
    .filter((row) => row.latitude != null && row.longitude != null && row.last_seen != null)
    .map((row) => ({
      id: row.id,
      name: row.name ?? null,
      avatar_url: row.avatar_url ?? null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      last_seen: String(row.last_seen),
    }));
}

/**
 * Check if the current user has a complete profile (row exists with name and avatar).
 * Used to redirect to create-profile when profile is missing or incomplete after sign-up.
 */
export async function hasCompleteProfile(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return false;
  const hasName = data.name != null && String(data.name).trim() !== '';
  return hasName;
}

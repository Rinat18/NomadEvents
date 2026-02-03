import { supabase } from './supabase';

export type LocalEvent = {
  id: string;
  title: string;
  description: string | null;
  meeting_place: string | null;
  meeting_lat: number | null;
  meeting_lng: number | null;
  emoji: string;
  place_name: string;
  place_category: string | null;
  creator_id: string;
  /** If false, join requests require creator approval */
  auto_accept: boolean;
  created_at: string;
  creator?: {
    name: string;
    avatar_url: string | null;
    vibe: string | null;
  };
};

export type ParticipantStatus = 'pending' | 'approved' | 'rejected';

export type LocalMessage = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: {
    name: string;
    avatar_url: string | null;
    vibe: string | null; // To show their vibe badge color in chat
  };
};

// Type for Supabase event row
type SupabaseEvent = {
  id: string;
  title: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  emoji: string;
  creator_id: string;
  auto_accept?: boolean;
  created_at: string;
  start_time: string | null;
  profiles?: {
    name: string | null;
    avatar_url: string | null;
    vibe: string | null;
  };
};

// Type for Supabase message row
type SupabaseMessage = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string | null;
    avatar_url: string | null;
    vibe: string | null;
  };
};

/**
 * Map Supabase event to LocalEvent format
 */
function mapToLocalEvent(row: SupabaseEvent): LocalEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    meeting_place: row.place_name,
    meeting_lat: row.lat,
    meeting_lng: row.lng,
    emoji: row.emoji || '📍',
    place_name: row.place_name || '',
    place_category: null,
    creator_id: row.creator_id,
    auto_accept: row.auto_accept !== false, // default true for backward compat
    created_at: row.created_at,
    creator: row.profiles ? {
      name: row.profiles.name || 'User',
      avatar_url: row.profiles.avatar_url,
      vibe: row.profiles.vibe,
    } : undefined,
  };
}

/**
 * Map Supabase message to LocalMessage format
 */
function mapToLocalMessage(row: SupabaseMessage): LocalMessage {
  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    body: row.content,
    created_at: row.created_at,
    author: {
      name: row.profiles?.name || 'Guest',
      avatar_url: row.profiles?.avatar_url || null,
      vibe: row.profiles?.vibe || null,
    },
  };
}

/**
 * List all events from Supabase
 */
export async function listEvents(): Promise<LocalEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        profiles:creator_id (
          name,
          avatar_url,
          vibe
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Events] Error listing events:', error.message);
      return [];
    }

    return (data || []).map(mapToLocalEvent);
  } catch (e) {
    console.error('[Events] Unexpected error:', e);
    return [];
  }
}

/**
 * Create a new event in Supabase
 */
export async function createEvent(input: {
  title: string;
  description: string | null;
  meeting_place: string | null;
  meeting_lat: number | null;
  meeting_lng: number | null;
  emoji: string;
  place_name: string;
  place_category: string | null;
  creator_id: string;
  /** If false, join requests require creator approval (face control) */
  auto_accept?: boolean;
}): Promise<LocalEvent> {
  const payload = {
    title: input.title,
    description: input.description,
    place_name: input.place_name || input.meeting_place,
    lat: input.meeting_lat,
    lng: input.meeting_lng,
    emoji: input.emoji || '📍',
    creator_id: input.creator_id,
    auto_accept: input.auto_accept !== false,
  };

  let result = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single();

  // If column auto_accept does not exist (PGRST204), retry without it
  if (result.error?.code === 'PGRST204' && result.error?.message?.includes('auto_accept')) {
    const { auto_accept: _, ...payloadWithoutAutoAccept } = payload as typeof payload & { auto_accept?: boolean };
    result = await supabase
      .from('events')
      .insert(payloadWithoutAutoAccept)
      .select()
      .single();
    if (result.error) {
      console.error('[Events] Error creating event:', result.error.message);
      throw result.error;
    }
    console.warn('[Events] auto_accept column missing in DB. Run migration: supabase/migrations/add_auto_accept_and_status.sql');
    return mapToLocalEvent(result.data);
  }

  if (result.error) {
    console.error('[Events] Error creating event:', result.error.message);
    throw result.error;
  }

  return mapToLocalEvent(result.data);
}

/**
 * Get event by ID from Supabase
 */
export async function getEventById(id: string): Promise<LocalEvent | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        profiles:creator_id (
          name,
          avatar_url,
          vibe
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Events] Error getting event:', error.message);
      return null;
    }

    return mapToLocalEvent(data);
  } catch (e) {
    console.error('[Events] Unexpected error:', e);
    return null;
  }
}

/**
 * List messages for an event from Supabase
 */
export async function listMessages(eventId: string): Promise<LocalMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:user_id (
          name,
          avatar_url,
          vibe
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Messages] Error listing messages:', error.message);
      return [];
    }

    return (data || []).map(mapToLocalMessage);
  } catch (e) {
    console.error('[Messages] Unexpected error:', e);
    return [];
  }
}

/**
 * Add a message to an event in Supabase
 */
export async function addMessage(input: {
  event_id: string;
  user_id: string;
  body: string;
  author: {
    name: string;
    avatar_url: string | null;
    vibe: string | null;
  };
}): Promise<LocalMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      event_id: input.event_id,
      user_id: input.user_id,
      content: input.body,
    })
    .select(`
      *,
      profiles:user_id (
        name,
        avatar_url,
        vibe
      )
    `)
    .single();

  if (error) {
    console.error('[Messages] Error adding message:', error.message);
    throw error;
  }

  return mapToLocalMessage(data);
}

/**
 * Delete an event and its associated messages from Supabase
 * Note: Messages are deleted automatically via ON DELETE CASCADE
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('[Events] Error deleting event:', error.message);
    throw error;
  }
}

/**
 * Join an event (or request to join). Status is 'approved' if event.auto_accept, else 'pending'.
 * If DB has no status column, inserts without it (everyone is treated as approved).
 */
export async function joinEvent(eventId: string, userId: string): Promise<ParticipantStatus> {
  const event = await getEventById(eventId);
  if (!event) throw new Error('Event not found');

  const status: ParticipantStatus = event.auto_accept ? 'approved' : 'pending';

  let result = await supabase
    .from('event_participants')
    .upsert(
      { event_id: eventId, user_id: userId, status },
      { onConflict: 'event_id,user_id' }
    );

  if (result.error && result.error.code !== '23505') {
    if (result.error.message?.includes('status') && result.error.message?.includes('does not exist')) {
      result = await supabase
        .from('event_participants')
        .upsert(
          { event_id: eventId, user_id: userId },
          { onConflict: 'event_id,user_id' }
        );
      if (result.error && result.error.code !== '23505') {
        console.error('[Events] Error joining event:', result.error.message);
        throw result.error;
      }
      return 'approved';
    }
    console.error('[Events] Error joining event:', result.error.message);
    throw result.error;
  }

  return status;
}

/**
 * Get current user's participation status for an event (null if not a participant).
 * If DB has no status column, treats existing row as 'approved'.
 */
export async function getMyParticipantStatus(
  eventId: string,
  userId: string
): Promise<ParticipantStatus | null> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.message?.includes('status') && error.message?.includes('does not exist')) {
      const { data: row } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      return row ? 'approved' : null;
    }
    console.error('[Events] Error getting participant status:', error.message);
    return null;
  }

  return data?.status ?? null;
}

/**
 * Update participant status (approve or reject). Creator only.
 * If DB has no status column, no-op (nothing to update).
 */
export async function updateParticipantStatus(
  eventId: string,
  participantUserId: string,
  status: ParticipantStatus
): Promise<void> {
  if (status !== 'approved' && status !== 'rejected') {
    throw new Error('Only approved or rejected can be set by creator');
  }

  const { error } = await supabase
    .from('event_participants')
    .update({ status })
    .eq('event_id', eventId)
    .eq('user_id', participantUserId);

  if (error) {
    if (error.message?.includes('status') && error.message?.includes('does not exist')) {
      return;
    }
    console.error('[Events] Error updating participant status:', error.message);
    throw error;
  }
}

/**
 * Leave an event (remove user from participants)
 */
export async function leaveEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Events] Error leaving event:', error.message);
    throw error;
  }
}

/**
 * Get event participants with status (for creator: separate Requests vs Going).
 * If DB has no status column, returns all as 'approved'.
 */
export async function getEventParticipantsWithStatus(eventId: string): Promise<Array<{
  id: string;
  name: string;
  avatar_url: string | null;
  vibe: string | null;
  status: ParticipantStatus;
}>> {
  const { data, error } = await supabase
    .from('event_participants')
    .select(`
      status,
      profiles:user_id (
        id,
        name,
        avatar_url,
        vibe
      )
    `)
    .eq('event_id', eventId);

  if (error) {
    if (error.message?.includes('status') && error.message?.includes('does not exist')) {
      const { data: fallbackData } = await supabase
        .from('event_participants')
        .select(`
          profiles:user_id (
            id,
            name,
            avatar_url,
            vibe
          )
        `)
        .eq('event_id', eventId);
      return (fallbackData || [])
        .filter((row: any) => row.profiles)
        .map((row: any) => ({
          id: row.profiles.id,
          name: row.profiles.name || 'User',
          avatar_url: row.profiles.avatar_url,
          vibe: row.profiles.vibe,
          status: 'approved' as ParticipantStatus,
        }));
    }
    console.error('[Events] Error getting participants:', error.message);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.profiles)
    .map((row: any) => ({
      id: row.profiles.id,
      name: row.profiles.name || 'User',
      avatar_url: row.profiles.avatar_url,
      vibe: row.profiles.vibe,
      status: (row.status || 'approved') as ParticipantStatus,
    }));
}

/**
 * Get event participants (backward compat - returns only approved if you need "going" list).
 */
export async function getEventParticipants(eventId: string): Promise<Array<{
  id: string;
  name: string;
  avatar_url: string | null;
  vibe: string | null;
}>> {
  const withStatus = await getEventParticipantsWithStatus(eventId);
  return withStatus
    .filter((p) => p.status === 'approved')
    .map(({ id, name, avatar_url, vibe }) => ({ id, name, avatar_url, vibe }));
}

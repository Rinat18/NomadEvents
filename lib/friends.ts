import { supabase } from './supabase';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export type FriendshipRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type ProfileBasic = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export type FriendRequestWithSender = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: FriendshipStatus;
  created_at: string;
  requester: ProfileBasic | null;
};

export type FriendWithProfile = {
  friendshipId: string;
  user: ProfileBasic;
};

/**
 * Get current user id. Returns null if not authenticated.
 */
async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Search profiles by name (case-insensitive). Excludes the current user.
 */
export async function searchUsers(query: string): Promise<ProfileBasic[]> {
  const me = await getCurrentUserId();
  if (!me) return [];

  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .neq('id', me)
    .ilike('name', `%${q}%`)
    .limit(30);

  if (error) {
    console.error('searchUsers error:', error);
    return [];
  }
  return (data as ProfileBasic[]) ?? [];
}

/**
 * Send a friend request (insert friendship with status 'pending').
 * Requester = current user, receiver = targetUserId.
 */
export async function sendFriendRequest(targetUserId: string): Promise<{ error: string | null }> {
  const me = await getCurrentUserId();
  if (!me) return { error: 'Not authenticated' };
  if (targetUserId === me) return { error: 'Cannot add yourself' };

  const { error } = await supabase.from('friendships').insert({
    requester_id: me,
    receiver_id: targetUserId,
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') return { error: null }; // unique violation = already sent
    console.error('sendFriendRequest error:', error);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Fetch incoming friend requests (receiver = me, status = 'pending') with requester profile.
 */
export async function getFriendRequests(): Promise<FriendRequestWithSender[]> {
  const me = await getCurrentUserId();
  if (!me) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `
      id,
      requester_id,
      receiver_id,
      status,
      created_at,
      requester:profiles!friendships_requester_id_fkey(id, name, avatar_url)
    `
    )
    .eq('receiver_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getFriendRequests error:', error);
    return [];
  }

  const rows = (data as (FriendshipRow & { requester: ProfileBasic | null })[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    requester_id: r.requester_id,
    receiver_id: r.receiver_id,
    status: r.status,
    created_at: r.created_at,
    requester: r.requester ?? null,
  }));
}

/**
 * Fetch my friends: friendships where (requester = me OR receiver = me) AND status = 'accepted'.
 * Returns the other user's profile for each.
 */
export async function getMyFriends(): Promise<FriendWithProfile[]> {
  const me = await getCurrentUserId();
  if (!me) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `
      id,
      requester_id,
      receiver_id,
      requester:profiles!friendships_requester_id_fkey(id, name, avatar_url),
      receiver:profiles!friendships_receiver_id_fkey(id, name, avatar_url)
    `
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${me},receiver_id.eq.${me}`);

  if (error) {
    console.error('getMyFriends error:', error);
    return [];
  }

  const rows = (data as (FriendshipRow & { requester: ProfileBasic; receiver: ProfileBasic })[]) ?? [];
  return rows.map((r) => {
    const friend = r.requester_id === me ? r.receiver : r.requester;
    return {
      friendshipId: r.id,
      user: friend,
    };
  });
}

/**
 * Accept a friend request (update status to 'accepted').
 */
export async function acceptRequest(friendshipId: string): Promise<{ error: string | null }> {
  const me = await getCurrentUserId();
  if (!me) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .eq('receiver_id', me)
    .eq('status', 'pending');

  if (error) {
    console.error('acceptRequest error:', error);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Decline a friend request (update status to 'rejected').
 */
export async function declineRequest(friendshipId: string): Promise<{ error: string | null }> {
  const me = await getCurrentUserId();
  if (!me) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('friendships')
    .update({ status: 'rejected' })
    .eq('id', friendshipId)
    .eq('receiver_id', me)
    .eq('status', 'pending');

  if (error) {
    console.error('declineRequest error:', error);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Get friendship status between me and another user (if any).
 * Returns 'pending' | 'accepted' | 'rejected' | null (no row).
 */
export async function getFriendshipStatus(
  otherUserId: string
): Promise<FriendshipStatus | null> {
  const me = await getCurrentUserId();
  if (!me) return null;

  const { data, error } = await supabase
    .from('friendships')
    .select('status, requester_id')
    .or(
      `and(requester_id.eq.${me},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${me})`
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.status as FriendshipStatus;
}

/**
 * Get friendship status for multiple user ids in one go (e.g. for search results).
 * Returns a map of userId -> 'pending' | 'accepted' | 'rejected'.
 */
export async function getFriendshipStatuses(
  userIds: string[]
): Promise<Record<string, FriendshipStatus>> {
  const me = await getCurrentUserId();
  if (!me || userIds.length === 0) return {};

  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id, status')
    .or(`requester_id.eq.${me},receiver_id.eq.${me}`);

  if (error) {
    console.error('getFriendshipStatuses error:', error);
    return {};
  }

  const result: Record<string, FriendshipStatus> = {};
  const set = new Set(userIds);
  for (const row of data ?? []) {
    const other = row.requester_id === me ? row.receiver_id : row.requester_id;
    if (set.has(other)) result[other] = row.status as FriendshipStatus;
  }
  return result;
}

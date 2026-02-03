import { supabase } from './supabase';

/**
 * Get current user ID from Supabase auth
 * Returns null if not authenticated
 */
export async function getOrCreateLocalUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return user.id;
}

/**
 * Get current user ID or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==============================================
// SUPABASE CREDENTIALS - Replace with your keys
// ==============================================
const supabaseUrl = 'https://odzylwuxkpjdpagirajx.supabase.co';
const supabaseAnonKey = 'sb_publishable_XEYwyaEvnqxE7f7COj72Pw_mF1ZCZbL';

// ==============================================
// SUPABASE CLIENT
// ==============================================
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ==============================================
// DATABASE TYPES (generated from schema)
// ==============================================
export type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  vibe: string | null;
  bio: string | null;
  updated_at: string;
};

export type Event = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  emoji: string;
  place_name: string | null;
  created_at: string;
};

export type EventParticipant = {
  event_id: string;
  user_id: string;
  joined_at: string;
};

export type Message = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
};


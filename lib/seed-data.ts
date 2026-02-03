/**
 * Seed Data for Nomadtable
 * 
 * NOTE: With Supabase integration, seeding is disabled.
 * Events and messages are now created by real users.
 * 
 * To add demo data, use the Supabase Dashboard SQL Editor:
 * 
 * -- Insert demo events (replace USER_ID with a real profile ID)
 * INSERT INTO events (title, description, lat, lng, place_name, emoji, creator_id)
 * VALUES 
 *   ('Morning Coffee & Code', 'Looking for a co-founder?', 42.876, 74.588, 'Sierra Coffee', '☕', 'USER_ID'),
 *   ('Friday Wine Tasting', 'Chilling after work', 42.873, 74.600, 'Divan Restaurant', '🍷', 'USER_ID');
 */

import { supabase } from './supabase';

/**
 * Check if seeding is needed and seed demo data
 * Currently disabled for Supabase - real users create real events
 */
export async function checkAndSeedData(): Promise<void> {
  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[Seed] No user logged in, skipping seed');
      return;
    }

    // With Supabase, we don't auto-seed demo data
    // Users create their own events
    console.log('[Seed] Supabase mode - seeding disabled, users create real events');
    
  } catch (error) {
    console.error('[Seed] Error:', error);
  }
}

/**
 * Optional: Seed demo events for a specific user
 * Call this manually if you want to populate the app with demo data
 */
export async function seedDemoEventsForUser(userId: string): Promise<void> {
  const demoEvents = [
    {
      title: 'Morning Coffee & Code',
      description: 'Looking for a co-founder or just want to code together? Join us!',
      lat: 42.876,
      lng: 74.588,
      place_name: 'Sierra Coffee',
      emoji: '☕',
      creator_id: userId,
    },
    {
      title: 'Friday Wine Tasting',
      description: 'Just chilling after work. Join us for some good wine!',
      lat: 42.873,
      lng: 74.600,
      place_name: 'Divan Restaurant',
      emoji: '🍷',
      creator_id: userId,
    },
    {
      title: 'Startup Pitch Discussion',
      description: 'Discussing startup ideas and networking with entrepreneurs.',
      lat: 42.869,
      lng: 74.590,
      place_name: 'ololoHaus',
      emoji: '🚀',
      creator_id: userId,
    },
    {
      title: 'English Speaking Club',
      description: 'Practice English in a relaxed environment. All levels welcome!',
      lat: 42.870,
      lng: 74.595,
      place_name: 'Chicken Star',
      emoji: '🗣️',
      creator_id: userId,
    },
  ];

  try {
    const { error } = await supabase.from('events').insert(demoEvents);
    
    if (error) {
      console.error('[Seed] Error seeding demo events:', error.message);
      return;
    }

    console.log('[Seed] Demo events created successfully!');
  } catch (e) {
    console.error('[Seed] Unexpected error:', e);
  }
}

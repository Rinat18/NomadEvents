-- ==============================================
-- NOMADTABLE DATABASE SCHEMA
-- Apply in Supabase SQL Editor (Dashboard > SQL Editor)
-- ==============================================

-- ==============================================
-- 1. PROFILES TABLE
-- Extends auth.users with app-specific data
-- ==============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  vibe text,  -- 'just-coffee', 'networking', 'friendship', etc.
  bio text,
  age integer,
  gender text,  -- 'male', 'female', 'other'
  languages text[] default array['ru'],  -- ['ru', 'en', 'ky']
  interests text[] default array[]::text[],  -- ['travel', 'food', 'sports']
  conversation_starters text[] default array[]::text[],  -- Ice breakers
  favorite_spots jsonb default '[]'::jsonb,  -- Array of {id, name, address, lat, lng}
  privacy jsonb default '{"ghostMode": false, "showExactLocation": false, "allowCheckIns": true}'::jsonb,
  location text default 'Бишкек, Кыргызстан',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration: Add missing columns to existing profiles table
-- (Run this if table already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'age') THEN
    ALTER TABLE public.profiles ADD COLUMN age integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
    ALTER TABLE public.profiles ADD COLUMN gender text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'languages') THEN
    ALTER TABLE public.profiles ADD COLUMN languages text[] default array['ru'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'interests') THEN
    ALTER TABLE public.profiles ADD COLUMN interests text[] default array[]::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'conversation_starters') THEN
    ALTER TABLE public.profiles ADD COLUMN conversation_starters text[] default array[]::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'favorite_spots') THEN
    ALTER TABLE public.profiles ADD COLUMN favorite_spots jsonb default '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'privacy') THEN
    ALTER TABLE public.profiles ADD COLUMN privacy jsonb default '{"ghostMode": false, "showExactLocation": false, "allowCheckIns": true}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'location') THEN
    ALTER TABLE public.profiles ADD COLUMN location text default 'Бишкек, Кыргызстан';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE public.profiles ADD COLUMN created_at timestamptz not null default now();
  END IF;
END $$;

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================
-- 2. EVENTS TABLE
-- Main events/meetups created by users
-- ==============================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  lat double precision,  -- Meeting point latitude
  lng double precision,  -- Meeting point longitude
  place_name text,       -- Human-readable place name
  start_time timestamptz,
  emoji text not null default '📍',
  auto_accept boolean not null default true,  -- If false, join requests need creator approval
  created_at timestamptz not null default now()
);

-- Index for faster queries by creator
create index if not exists events_creator_id_idx on public.events(creator_id);

-- Migration: Add auto_accept to existing events table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'auto_accept') THEN
    ALTER TABLE public.events ADD COLUMN auto_accept boolean not null default true;
  END IF;
END $$;

-- ==============================================
-- 3. EVENT PARTICIPANTS TABLE
-- Many-to-many: users joining events (with approval status)
-- ==============================================
create table if not exists public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Migration: Add status to existing event_participants (if column missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_participants' AND column_name = 'status') THEN
    ALTER TABLE public.event_participants ADD COLUMN status text not null default 'approved' check (status in ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Index for faster queries
create index if not exists event_participants_user_id_idx on public.event_participants(user_id);
create index if not exists event_participants_event_id_idx on public.event_participants(event_id);

-- ==============================================
-- 4. MESSAGES TABLE
-- Chat messages within event chats
-- ==============================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Index for faster message retrieval
create index if not exists messages_event_id_idx on public.messages(event_id);
create index if not exists messages_created_at_idx on public.messages(created_at);

-- ==============================================
-- 5. ENABLE REALTIME
-- Chat messages update instantly
-- ==============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_participants;

-- ==============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.messages enable row level security;

-- ----------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------

-- Anyone can view profiles (public read)
create policy "profiles_select_public"
on public.profiles for select
to anon, authenticated
using (true);

-- Users can update only their own profile
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Users can insert their own profile (handled by trigger, but just in case)
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

-- ----------------------------------------------
-- EVENTS POLICIES
-- ----------------------------------------------

-- Anyone can view events (public read)
create policy "events_select_public"
on public.events for select
to anon, authenticated
using (true);

-- Authenticated users can create events
create policy "events_insert_authenticated"
on public.events for insert
to authenticated
with check (auth.uid() = creator_id);

-- Only creator can update their event
create policy "events_update_own"
on public.events for update
to authenticated
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

-- Only creator can delete their event
create policy "events_delete_own"
on public.events for delete
to authenticated
using (auth.uid() = creator_id);

-- ----------------------------------------------
-- EVENT PARTICIPANTS POLICIES
-- ----------------------------------------------

-- Anyone can see participants
create policy "participants_select_public"
on public.event_participants for select
to anon, authenticated
using (true);

-- Authenticated users can join events (insert themselves)
create policy "participants_insert_self"
on public.event_participants for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can leave events (delete themselves)
create policy "participants_delete_self"
on public.event_participants for delete
to authenticated
using (auth.uid() = user_id);

-- Event creator can remove participants
create policy "participants_delete_creator"
on public.event_participants for delete
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = event_participants.event_id
    and events.creator_id = auth.uid()
  )
);

-- Event creator can update participant status (approve/reject)
create policy "participants_update_creator"
on public.event_participants for update
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = event_participants.event_id
    and events.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events
    where events.id = event_participants.event_id
    and events.creator_id = auth.uid()
  )
);

-- ----------------------------------------------
-- MESSAGES POLICIES
-- ----------------------------------------------

-- Anyone can read messages (public chats)
create policy "messages_select_public"
on public.messages for select
to anon, authenticated
using (true);

-- Authenticated users can send messages
create policy "messages_insert_authenticated"
on public.messages for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can delete their own messages
create policy "messages_delete_own"
on public.messages for delete
to authenticated
using (auth.uid() = user_id);

-- Event creator can delete any message in their event
create policy "messages_delete_creator"
on public.messages for delete
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = messages.event_id
    and events.creator_id = auth.uid()
  )
);

-- ==============================================
-- 7. HELPER FUNCTIONS
-- ==============================================

-- Function to get event with creator profile
create or replace function public.get_event_with_creator(event_uuid uuid)
returns json as $$
  select json_build_object(
    'event', row_to_json(e),
    'creator', row_to_json(p)
  )
  from public.events e
  join public.profiles p on e.creator_id = p.id
  where e.id = event_uuid;
$$ language sql stable;

-- Function to get messages with author profiles
create or replace function public.get_messages_with_authors(event_uuid uuid)
returns json as $$
  select coalesce(json_agg(
    json_build_object(
      'id', m.id,
      'content', m.content,
      'created_at', m.created_at,
      'author', json_build_object(
        'id', p.id,
        'name', p.name,
        'avatar_url', p.avatar_url,
        'vibe', p.vibe
      )
    ) order by m.created_at asc
  ), '[]'::json)
  from public.messages m
  join public.profiles p on m.user_id = p.id
  where m.event_id = event_uuid;
$$ language sql stable;

-- ==============================================
-- DONE! Schema is ready.
-- ==============================================

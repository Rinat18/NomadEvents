-- ==============================================
-- FRIENDSHIPS TABLE
-- Run in Supabase SQL Editor if not using migrations
-- ==============================================

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique(requester_id, receiver_id)
);

create index if not exists friendships_requester_id_idx on public.friendships(requester_id);
create index if not exists friendships_receiver_id_idx on public.friendships(receiver_id);
create index if not exists friendships_status_idx on public.friendships(status);

alter table public.friendships enable row level security;

-- Users can see friendships where they are requester or receiver
create policy "friendships_select_own"
on public.friendships for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = receiver_id);

-- Users can insert a row where they are the requester
create policy "friendships_insert_requester"
on public.friendships for insert
to authenticated
with check (auth.uid() = requester_id);

-- Receiver can update (accept/decline); requester cannot update after send
create policy "friendships_update_receiver"
on public.friendships for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

-- Optional: allow delete for own rows (e.g. unfriend)
create policy "friendships_delete_own"
on public.friendships for delete
to authenticated
using (auth.uid() = requester_id or auth.uid() = receiver_id);

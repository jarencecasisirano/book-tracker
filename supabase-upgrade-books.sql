-- ============================================================
-- Book Tracker - Upgrade: Sync Books across devices
-- Run this ONCE in the Supabase SQL Editor (existing projects only).
-- (Reviews setup from supabase-setup.sql must already be in place.)
-- Favorites intentionally stay per-device, so they are NOT stored here.
-- ============================================================

-- Shared books table
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  book_key text not null unique,
  title text not null,
  author text not null,
  genre text default '',
  rating int not null default 0 check (rating between 0 and 5),
  date_read text default '',
  cover text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "anyone can read books" on public.books
  for select using (true);

create policy "anyone can insert books" on public.books
  for insert with check (true);

-- Allow edits to sync (casual/small trusted users; same model as reviews)
create policy "anyone can update books" on public.books
  for update using (true);

-- Delete keys table (completely private - no anon access)
create table if not exists public.book_delete_keys (
  book_id uuid primary key references public.books(id) on delete cascade,
  delete_key text not null
);

alter table public.book_delete_keys enable row level security;

-- Function: add or update a book + store delete key (atomic, upserts by book_key)
create or replace function public.add_book(
  p_book_key text,
  p_title text,
  p_author text,
  p_genre text,
  p_rating int,
  p_date_read text,
  p_cover text,
  p_notes text,
  p_delete_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.books (book_key, title, author, genre, rating, date_read, cover, notes)
  values (p_book_key, p_title, p_author, p_genre, p_rating, p_date_read, p_cover, p_notes)
  on conflict (book_key) do update set
    title = excluded.title,
    author = excluded.author,
    genre = excluded.genre,
    rating = excluded.rating,
    date_read = excluded.date_read,
    cover = excluded.cover,
    notes = excluded.notes
  returning id into v_id;

  insert into public.book_delete_keys (book_id, delete_key)
  values (v_id, p_delete_key)
  on conflict (book_id) do update set delete_key = excluded.delete_key;

  return v_id;
end;
$$;

-- Function: delete a book only if delete_key matches
create or replace function public.delete_book(
  p_book_id uuid,
  p_delete_key text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.books
  where id = p_book_id
    and exists (
      select 1 from public.book_delete_keys
      where book_id = p_book_id
        and delete_key = p_delete_key
    );
$$;
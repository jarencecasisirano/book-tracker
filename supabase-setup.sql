-- ============================================================
-- Book Tracker - Supabase Setup
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- Reviews table (anon can read and insert)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id text not null,
  reviewer text not null,
  rating int not null check (rating between 1 and 5),
  text text default '',
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;

create policy "anyone can read reviews" on public.reviews
  for select using (true);

create policy "anyone can insert reviews" on public.reviews
  for insert with check (true);

-- Delete keys table (completely private - no anon access)
create table public.review_delete_keys (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  delete_key text not null
);

alter table public.review_delete_keys enable row level security;

-- Function: add review + store delete key (atomic)
create or replace function public.add_review(
  p_book_id text,
  p_reviewer text,
  p_rating int,
  p_text text,
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
  insert into public.reviews (book_id, reviewer, rating, text)
  values (p_book_id, p_reviewer, p_rating, p_text)
  returning id into v_id;

  insert into public.review_delete_keys (review_id, delete_key)
  values (v_id, p_delete_key);

  return v_id;
end;
$$;

-- Function: delete review only if delete_key matches
create or replace function public.delete_review(
  p_review_id uuid,
  p_delete_key text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.reviews
  where id = p_review_id
    and exists (
      select 1 from public.review_delete_keys
      where review_id = p_review_id
        and delete_key = p_delete_key
    );
$$;
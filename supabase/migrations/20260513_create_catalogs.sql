-- catalogs table
-- Stores PDF catalog metadata; actual files live in Supabase Storage (media bucket)

create table if not exists public.catalogs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  file_url    text not null,
  file_name   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row Level Security
alter table public.catalogs enable row level security;

-- All authenticated users can view catalogs owned by anyone in the same org
-- (for now: any logged-in user can see all catalogs — adjust if multi-tenant needed)
create policy "catalogs_select" on public.catalogs
  for select using (auth.uid() is not null);

-- Only the owner can insert
create policy "catalogs_insert" on public.catalogs
  for insert with check (auth.uid() = owner_id);

-- Only the owner can update
create policy "catalogs_update" on public.catalogs
  for update using (auth.uid() = owner_id);

-- Only the owner can delete
create policy "catalogs_delete" on public.catalogs
  for delete using (auth.uid() = owner_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger catalogs_updated_at
  before update on public.catalogs
  for each row execute procedure public.handle_updated_at();

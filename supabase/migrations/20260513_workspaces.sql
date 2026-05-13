-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-tenant: Workspaces
--
-- Each client of the SaaS gets one workspace.
-- All their contacts, conversations, and credentials are scoped to it.
--
-- What lives per-workspace:
--   meta_phone_number_id  — their WhatsApp Business phone number ID
--   meta_waba_id          — their WhatsApp Business Account ID
--   meta_access_token     — system user token for their WABA
--
-- What stays global (env vars, shared across all workspaces):
--   META_APP_SECRET       — your Meta app's secret (used for HMAC webhook verification)
--   META_VERIFY_TOKEN     — your Meta app's webhook verify token
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Workspaces table ─────────────────────────────────────────────────────────

create table if not exists public.workspaces (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  -- The Supabase user ID of the admin who "owns" this workspace.
  -- Used to attribute incoming webhook messages to the right workspace.
  owner_id              uuid        references auth.users(id) on delete set null,
  -- Meta WhatsApp Cloud API credentials (per-workspace)
  meta_phone_number_id  text,
  meta_waba_id          text,
  meta_access_token     text,       -- TODO: encrypt with Supabase Vault in production
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Index for webhook routing: look up workspace by phone number ID
create index if not exists workspaces_meta_phone_idx
  on public.workspaces (meta_phone_number_id)
  where meta_phone_number_id is not null;

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table public.workspaces enable row level security;

-- Any member of a workspace can read it
create policy "ws_select" on public.workspaces
  for select using (
    id in (
      select workspace_id from public.profiles where id = auth.uid()
    )
  );

-- Only admins can update workspace settings (Meta credentials, name)
create policy "ws_update" on public.workspaces
  for update using (
    id in (
      select workspace_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-update updated_at
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute procedure public.handle_updated_at();

-- 2. Link profiles to workspaces ──────────────────────────────────────────────

alter table public.profiles
  add column if not exists workspace_id uuid references public.workspaces(id);

-- 3. Backfill: create one workspace for each existing profile ─────────────────
--    Each existing user becomes their own workspace owner.
--    On a fresh database this loop simply does nothing.

do $$
declare
  p   record;
  wid uuid;
begin
  for p in
    select id, email, display_name
    from public.profiles
    where workspace_id is null
  loop
    insert into public.workspaces (name, owner_id)
    values (coalesce(p.display_name, p.email, 'Mi Workspace'), p.id)
    returning id into wid;

    update public.profiles
    set workspace_id = wid
    where id = p.id;
  end loop;
end;
$$;

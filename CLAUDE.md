# CRM Assistant — Pancho's Business CRM

## Project
- Vercel project: `pancho-crm` (team: `team_WB9GZcmZcTYAEKNiDB9teWLO`)
- Supabase project: `crm-assistant`
- Region: wherever Supabase project was created
- Runtime: Node.js 20 (`.nvmrc` → `20`)
- Package manager: **npm only** — never Yarn, pnpm, or Bun
- GitHub: `Web-My-Money/crm-assistant`

## Stack
- **Frontend**: Next.js 16 (App Router), React 18, TypeScript strict
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: lucide-react
- **State**: TanStack Query for server cache
- **Backend**: Next.js API routes (`web/src/app/api/`)
- **Auth**: Supabase Auth (email/password, cookie-based sessions via `@supabase/ssr`)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (`media` bucket — images, videos, audio, catalog PDFs)
- **WhatsApp**: Meta WhatsApp Cloud API (official Graph API)
- **Hosting**: Vercel
- **i18n**: next-intl (`es`/`en`, default `es`, prefix `as-needed`)
- **Drag & Drop**: @dnd-kit (for Kanban board)
- **Forms**: react-hook-form + zod

## Structure
- Single Next.js app deployed to Vercel: `/web`
- `/legacy-replit` — archived original Replit app (reference only, do NOT modify)
- Auth routes live in `web/src/app/[locale]/(auth)/`
- Dashboard routes live in `web/src/app/[locale]/(dashboard)/`

## Key Routes
| Route | What it does |
|-------|-------------|
| `/dashboard` | Main dashboard with stats + bot toggle |
| `/conversations` | WhatsApp/Instagram conversations list |
| `/conversations/[id]` | Conversation detail + chat interface |
| `/contacts` | CRM Kanban board (leads) |
| `/clients` | Contact database (customers) |
| `/templates` | WhatsApp message templates |
| `/quick-responses` | Canned response manager |
| `/automations` | Workflow builder |
| `/team` | User roles and invitations |
| `/catalogs` | PDF catalog management |
| `/settings` | Bot config, profile |
| `/settings/whatsapp` | Evolution API / WhatsApp connection |

## API Routes
| Route | Purpose |
|-------|---------|
| `GET  /api/webhooks/meta` | Meta webhook verification (hub.challenge) |
| `POST /api/webhooks/meta` | Receives incoming WhatsApp messages from Meta Cloud API |
| `POST /api/whatsapp/send` | Sends a message via Meta Cloud API |
| `GET  /api/whatsapp/status` | Meta phone number connection status |
| `POST /api/team/invite` | Server-side team member invitation (admin only) |

## Supabase Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (roles: admin/agent, permissions, display_name) |
| `contacts` | CRM contacts (auto-created from WhatsApp, or manually) |
| `conversations` | WhatsApp/Instagram threads |
| `messages` | Chat messages per conversation |
| `leads` | Kanban CRM leads |
| `templates` | WhatsApp message templates |
| `quick_responses` | Canned replies |
| `automations` | Workflow definitions |
| `catalogs` | PDF catalog metadata (file stored in Storage `media` bucket) |
| `bot_config` | Bot configuration (row id=1) |
| `_dlq` | Dead-letter queue for failed webhook events |

## Auth & Roles
- `admin` — full access, can invite users, manage settings, see all data
- `agent` — can see conversations, CRM; permissions are per-user toggles

## Environment Variables
Copy `web/.env.example` to `web/.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

META_PHONE_NUMBER_ID=
META_ACCESS_TOKEN=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_OWNER_ID=

NEXT_PUBLIC_APP_URL=
```

## Running Locally
```bash
cd web
npm install
npm run dev
```

## Naming Conventions
- Files: `kebab-case`
- Supabase columns: `snake_case`
- TypeScript interfaces: camelCase properties (mapped from snake_case in `api.ts`)
- Components: `PascalCase`
- Env vars: `ALL_CAPS_WITH_UNDERSCORES`

## Before Committing
- Run `npm run type-check` from `web/`
- Never commit `.env.local` or secrets
- Never modify files in `/legacy-replit` (it's an archive)

## Ownership
This is Pancho's personal business CRM. It has its OWN Supabase project (`crm-assistant`) with its own isolated database. WMM provides standards and tooling, but Pancho owns the code, data, and billing.

---

## WMM Engineering Standards (from wmm-agents)

### Infrastructure Rules (Non-Negotiable)
1. **npm only** — Never use Yarn, pnpm, or Bun
2. **No secrets in code** — Use `process.env`. Never hardcode API keys, tokens, or passwords
3. **One app = One Supabase project = One isolated database**
4. **Never cancel long-running commands** — `npm install` can take 4-5 min

### Supabase Conventions
- **Schema changes: additive only** — Never remove/rename/change type of a production column without a migration
- **Timestamps**: Use `DEFAULT now()` in Supabase; use `new Date().toISOString()` when updating from client
- **RLS**: Enable Row Level Security on all tables; use `owner_id = auth.uid()` patterns

### API Routes Standards
- Webhook handlers (`/api/webhooks/*`): Always verify HMAC/secret, return 200 to prevent retries, log errors to `_dlq`
- Authenticated routes: Always call `supabase.auth.getUser()` server-side, never trust client-supplied user IDs
- Admin routes: Always verify `role = 'admin'` from `profiles` table before proceeding

### Frontend Standards (Next.js)
- App Router with `[locale]` prefix (next-intl)
- **ALL dashboard pages must live in `web/src/app/[locale]/(dashboard)/`** — never in `(dashboard)/` without locale
- Components: shadcn/ui from `web/src/components/ui/` — don't build custom UI primitives
- Icons: lucide-react
- Server Components by default, `"use client"` only when needed
- Forms: react-hook-form + zod for validation
- Data fetching: TanStack Query for server state caching
- TypeScript strict mode — no `any` types without justification

### Security Rules (MANDATORY)
- NEVER run `git push --force` to any branch
- NEVER modify Supabase RLS policies without explicit approval
- NEVER delete database rows — use `status: 'archived'` or `is_active: false` pattern instead
- NEVER commit .env.local, service account keys, or API tokens to git
- All webhook handlers must verify the incoming secret before processing

---

## Token-Saving Best Practices for Claude Code

1. **Read this CLAUDE.md first** — It has everything you need. Don't re-explore what's documented here
2. **Don't re-read files you already have in context** — Use what you have
3. **Batch related changes** — Edit multiple related things in one pass
4. **Don't over-explore** — Use Glob/Grep to find files directly
5. **Keep responses concise** — The diff speaks for itself
6. **Run typecheck once** before committing, not after every edit
7. **Don't add unnecessary comments** to code you didn't change
8. **Don't refactor beyond what was asked** — Stay on task

# CRM Assistant — Pancho's Business CRM

## Project
- Firebase project: `dapa-crm-assistant`
- Region: `us-central1`
- Runtime: Node.js 20 (`.nvmrc` → `20`)
- Cloud Functions: v2 (`firebase-functions`)
- Firestore: Native mode
- Package manager: **npm only** — never Yarn, pnpm, or Bun
- GitHub: `Web-My-Money/crm-assistant`

## Stack
- **Frontend**: Next.js 16 (App Router), React 18, TypeScript strict
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: lucide-react
- **State**: TanStack Query for server cache
- **Backend**: Firebase Cloud Functions (TypeScript)
- **Auth**: Firebase Auth (email/password + roles)
- **Database**: Firestore
- **Drag & Drop**: @dnd-kit (for Kanban board)

## Structure
- Monorepo: `/web` (Next.js frontend) + `/functions` (Cloud Functions backend)
- `/legacy-replit` — archived original Replit app (reference only, do NOT modify)
- App routes live in `web/src/app/(dashboard)/`
- Auth routes live in `web/src/app/(auth)/`

## Key Routes
| Route | What it does |
|-------|-------------|
| `/dashboard` | Main dashboard with stats |
| `/conversations` | WhatsApp/Instagram conversations list + detail |
| `/contacts` | CRM contacts management |
| `/leads` | Kanban board (nuevos -> proforma -> venta -> completado/perdido) |
| `/templates` | WhatsApp message templates |
| `/quick-responses` | Canned response manager |
| `/automations` | Workflow builder (triggers + actions) |
| `/team` | User roles and conversation assignment |
| `/settings` | Bot config, business hours, Odoo integration |

## Firestore Collections
| Collection | Purpose |
|-----------|---------|
| `users` | Auth users with roles (admin/superAdmin) |
| `contacts` | CRM contacts (owner-scoped) |
| `conversations` | WhatsApp/Instagram threads |
| `conversations/{id}/messages` | Chat messages per conversation |
| `leads` | Kanban CRM leads (owner-scoped) |
| `botConfig` | Bot configuration (admin only) |
| `botTraining` | Q&A training pairs (admin only) |
| `templates` | WhatsApp message templates (admin only) |

## Auth & Roles
- `superAdmin` — full access, can manage users and delete anything
- `admin` — can manage settings, templates, bot config, see all data
- Regular users — can only see/edit their own contacts and leads

## Environment Variables
Copy `web/.env.example` to `web/.env.local` and fill in:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dapa-crm-assistant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Running Locally
```bash
# Install deps
cd web && npm install
cd ../functions && npm install

# Start dev server
cd web && npm run dev
```

## Naming Conventions
- Files: `kebab-case`
- Firestore collections: `camelCase` (existing convention in this repo)
- Components: `PascalCase`
- Env vars: `ALL_CAPS_WITH_UNDERSCORES`

## Before Committing
- Run `npm run type-check` from `web/`
- Never commit `.env.local` or secrets
- Never modify files in `/legacy-replit` (it's an archive)

## Ownership
This is Pancho's personal business CRM. It has its OWN Firebase project (`dapa-crm-assistant`) with its own isolated database. WMM provides standards and tooling, but Pancho owns the code, data, and billing.

Standards reference: see `wmm-agents` repo for WMM-wide conventions.

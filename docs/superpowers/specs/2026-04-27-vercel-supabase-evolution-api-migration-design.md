# CRM Assistant — Vercel + Supabase + Evolution API Migration Design

**Date:** 2026-04-27  
**Status:** Approved  
**Scope:** Full migration from Firebase/Firestore/Cloud Functions/Whapi → Vercel/Supabase/Evolution API

---

## 1. Context

Pancho's CRM (`dapa-crm-assistant`) was previously built on Firebase App Hosting + Cloud Functions + Firestore, with Whapi (paid) as the WhatsApp connector. This migration moves the entire stack to:

- **Vercel** — Next.js hosting (already created)
- **Supabase** — PostgreSQL database + Auth + Realtime (project `crm-assistant`, id: `jgtznpsxiyrmyxyzyxnv`)
- **Evolution API on Railway** — free, QR-code-based WhatsApp connector (shared across WMM apps, each client = one named instance)

The migration is a **hard cutover** — no parallel run with Firebase/Whapi.

---

## 2. Architecture

```
Railway (persistent)
  └── Evolution API
        ├── instance: pancho-dapa-crm   ← Pancho's WhatsApp session
        └── instance: [future WMM clients]

Vercel
  └── Next.js app (web/)
        ├── app/api/webhooks/evolution/route.ts   ← receives inbound messages
        ├── app/api/whatsapp/status/route.ts      ← QR code + connection state
        ├── app/api/whatsapp/send/route.ts        ← outbound messages
        └── all other /api/* routes               ← replaces all Cloud Functions

Supabase (crm-assistant)
  └── PostgreSQL — all core tables already exist
  └── Auth       — profiles table wired to auth.users
  └── Realtime   — replaces Firestore onSnapshot listeners
  └── RLS        — enabled on all tables
```

---

## 3. Database — Existing Schema

All tables already exist in Supabase with RLS enabled:

| Table | Purpose |
|---|---|
| `profiles` | Users with roles: agent / admin / superAdmin |
| `contacts` | CRM contacts, owner-scoped |
| `conversations` | WhatsApp/Instagram threads |
| `messages` | Chat messages per conversation |
| `leads` | Kanban CRM leads (nuevos→proforma→venta→completado/perdido) |
| `templates` | WhatsApp message templates |
| `quick_responses` | Canned responses |
| `bot_config` | Bot configuration (singleton, id=1) |
| `bot_training` | Q&A training pairs |
| `automations` | Workflow definitions |

---

## 4. Database — Required Additions (Migrations)

The following must be added via Supabase migrations before implementation:

### `contacts` table
```sql
ALTER TABLE contacts ADD COLUMN phone_normalized text;
CREATE INDEX contacts_phone_normalized_idx ON contacts(phone_normalized);
```
*Purpose: digits-only phone for deduplication across format variations.*

### `conversations` table
```sql
ALTER TABLE conversations ADD COLUMN contact_id uuid REFERENCES contacts(id);
ALTER TABLE conversations ADD COLUMN last_message_at timestamptz DEFAULT now();
CREATE INDEX conversations_last_message_at_idx ON conversations(last_message_at DESC);

-- Required for idempotent upsert in webhook handler (replaces Firestore deterministic doc ID)
ALTER TABLE conversations ADD CONSTRAINT conversations_owner_phone_unique
  UNIQUE (owner_id, customer_phone);
```

### `messages` table
```sql
ALTER TABLE messages ADD COLUMN evolution_message_id text UNIQUE;
ALTER TABLE messages ADD COLUMN media_url text;
ALTER TABLE messages ADD COLUMN filename text;
ALTER TABLE messages ADD COLUMN message_timestamp timestamptz;

-- Expand message_type to include audio and sticker
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','video','document','audio','sticker','note']));
```

### New `_dlq` table
```sql
CREATE TABLE _dlq (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  source text NOT NULL,
  payload jsonb NOT NULL,
  error text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- No RLS — server-side only, accessed via service role key
```

---

## 5. Environment Variables

### Remove (Firebase + Whapi)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
WHAPI_API_TOKEN
WHAPI_OWNER_ID
```

### Add (Supabase + Evolution API)
```
NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     — public anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY         — server-side only, bypasses RLS
EVOLUTION_API_URL                 — Railway base URL (e.g. https://evo.railway.app)
EVOLUTION_API_KEY                 — global API key set on Railway
EVOLUTION_INSTANCE_NAME           — named session (e.g. "pancho-dapa-crm")
EVOLUTION_WEBHOOK_SECRET          — shared secret for webhook signature verification
EVOLUTION_OWNER_ID                — Supabase user UUID of the account owner
```

---

## 6. New Files — `web/src/`

### Supabase clients
```
lib/supabase/client.ts     — createBrowserClient() for use in Client Components
lib/supabase/server.ts     — createServerClient() for Server Components + Route Handlers
```

### Evolution API client
```
lib/evolution-client.ts    — REST calls to Railway Evolution API
  exports:
    getInstanceStatus()    → { status, phone?, name?, qrCode? }
    sendText(to, text)     → { id }
    sendMedia(to, url, type, caption?, filename?) → { id }
```

### API Route Handlers (replaces Cloud Functions)
```
app/api/webhooks/evolution/route.ts
  POST — receives Evolution API events, writes to Supabase

app/api/whatsapp/status/route.ts
  GET  — returns connection state + QR code if needed (auth required)

app/api/whatsapp/send/route.ts
  POST — sends text or media via Evolution API (auth required)
```

---

## 7. Data Flow

### Inbound message
```
1. WhatsApp user sends message
2. Evolution API (Railway) → POST /api/webhooks/evolution
3. Verify EVOLUTION_WEBHOOK_SECRET header → 401 if invalid
4. Filter: only process "messages.upsert" events
5. Parse Evolution payload → normalized shape
6. findOrCreateContact by phone_normalized (Supabase upsert on contacts)
7. Upsert conversation via ON CONFLICT (owner_id, customer_phone) DO UPDATE
8. Insert message — ON CONFLICT (evolution_message_id) DO NOTHING
9. On unhandled error → insert to _dlq with full payload
10. Return 200 immediately
```

### Outbound message
```
1. Agent sends message in /conversations/[id]
2. POST /api/whatsapp/send { conversationId, content, type }
3. Verify Supabase session → 401 if unauthenticated
4. Call Evolution API: POST /message/sendText/{instanceName}
5. On success → insert message to Supabase (role='assistant')
6. Supabase Realtime broadcasts update to all connected sessions
```

### Connection status + QR
```
1. /settings/whatsapp polls GET /api/whatsapp/status
   — every 5s when status is 'qr' or 'loading'
   — every 30s when 'active'
2. Route handler → GET /instance/connectionState/{instanceName} on Railway
3. If status = 'close' → also GET /instance/connect/{instanceName} for QR base64
4. Returns { status, phone?, name?, qrCode? }
   — same shape as current WhapiStatus so QR display component needs no changes
```

---

## 8. Evolution API Payload Mapping

### Incoming webhook (Evolution API → our schema)
```
event.data.key.id              → evolution_message_id
event.data.key.remoteJid       → customer_phone (strip @s.whatsapp.net)
event.data.key.fromMe          → role: fromMe=true → 'assistant', false → 'user'
event.data.pushName            → customer_name
event.data.messageType         → message_type
event.data.message.conversation → content (text)
event.data.message.imageMessage.caption → content (image)
event.data.message.imageMessage.url    → media_url
event.data.message.documentMessage.fileName → filename
event.data.messageTimestamp    → message_timestamp
```

### Skip conditions
- `event.event !== 'messages.upsert'`
- `remoteJid` ends with `@g.us` (group messages)
- `remoteJid` contains `-` (legacy group format)

---

## 9. Auth Migration

| Old (Firebase) | New (Supabase) |
|---|---|
| `getAuth().currentUser` | `supabase.auth.getUser()` |
| `signInWithEmailAndPassword` | `supabase.auth.signInWithPassword` |
| Firebase custom claims (role) | `profiles.role` column |
| Firebase Auth middleware in CF | `createServerClient().auth.getUser()` in Route Handlers |
| `onAuthStateChanged` listener | `supabase.auth.onAuthStateChange` |

RLS policies already reference `auth.uid()` — Supabase Auth integrates natively.

---

## 10. Realtime Migration

| Old (Firestore) | New (Supabase Realtime) |
|---|---|
| `onSnapshot(conversationRef)` | `supabase.channel('messages').on('postgres_changes', ...)` |
| `onSnapshot(messagesQuery)` | Filter by `conversation_id` on `messages` table |
| Auto-unsubscribe on unmount | `channel.unsubscribe()` in `useEffect` cleanup |

---

## 11. Files to Retire

```
functions/                        — entire directory (all Cloud Functions)
apphosting.yaml
apphosting.prod.yaml
firebase.json                     — replace with vercel.json if needed
firestore.rules
firestore.indexes.json
storage.rules
remoteconfig.template.json
web/src/lib/firebase.ts           — replace with supabase clients
```

---

## 12. Frontend Design

Visual direction: **"Noche"** — warm dark theme with amber gold accent.  
Reference prototype: `design-preview.html` at repo root.

Key tokens:
```css
--bg-0: #0D0C0A   (base background)
--bg-1: #161511   (surfaces)
--amber: #E8870A  (primary accent)
--green: #22C55E  (online / WhatsApp status)
--font-d: 'Syne'  (display / headings)
--font-b: 'DM Sans' (body)
```

Three-panel layout: 60px icon nav → 300px conversation list → flex-1 main panel.

---

## 13. Security

- Webhook endpoint: no user auth, verify `EVOLUTION_WEBHOOK_SECRET` header only
- All other `/api/*` routes: require valid Supabase session (`getUser()`)
- Server-side DB writes (webhook): use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Client-side DB reads: use anon key + RLS (policies already in place)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- No `EVOLUTION_API_KEY` exposed client-side

---

## 14. What Does NOT Change

- Firestore schema logic → same shape in PostgreSQL (snake_case field names)
- QR code display component → same `{ status, qrCode }` shape
- Conversation/message data model → same fields, same semantics
- Kanban lead stages → same: nuevos / proforma / venta / completado / perdido
- Auth roles → same: agent / admin / superAdmin
- RLS → already enabled on all Supabase tables

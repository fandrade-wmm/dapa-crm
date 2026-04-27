# Vercel + Supabase + Evolution API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate CRM Assistant from Firebase/Firestore/Cloud Functions/Whapi to Vercel/Supabase/Evolution API with a hard cutover and zero data loss on schema.

**Architecture:** Vercel hosts the Next.js app; all Cloud Functions are replaced by Next.js Route Handlers in `web/src/app/api/`. Supabase provides PostgreSQL + Auth + Realtime (project `crm-assistant`, id `jgtznpsxiyrmyxyzyxnv`). Evolution API runs on Railway as the shared QR-code-based WhatsApp connector, one named instance per WMM client.

**Tech Stack:** Next.js 15 (App Router), @supabase/supabase-js 2.x, @supabase/ssr, TypeScript strict, Tailwind CSS, shadcn/ui, Zod, Evolution API v2

**Spec:** `docs/superpowers/specs/2026-04-27-vercel-supabase-evolution-api-migration-design.md`

---

## File Map

### Create
| File | Purpose |
|---|---|
| `web/src/lib/supabase/client.ts` | Browser Supabase client (Client Components) |
| `web/src/lib/supabase/server.ts` | Server Supabase client + service client (Route Handlers) |
| `web/src/lib/evolution-client.ts` | REST wrapper for Evolution API |
| `web/src/middleware.ts` | Supabase session refresh + auth redirect |
| `web/src/app/api/webhooks/evolution/route.ts` | Inbound WhatsApp message handler |
| `web/src/app/api/whatsapp/status/route.ts` | Connection state + QR code |
| `web/src/app/api/whatsapp/send/route.ts` | Outbound message sender |
| `docs/migrations/001-evolution-api-fields.sql` | Migration SQL for reference |

### Modify
| File | Change |
|---|---|
| `web/package.json` | Remove `firebase`, add `@supabase/supabase-js` + `@supabase/ssr` |
| `web/.env.example` | Swap Firebase + Whapi vars for Supabase + Evolution vars |
| `web/src/lib/api.ts` | Replace all Firebase callable calls with Supabase queries |
| `web/src/app/(dashboard)/settings/whatsapp/page.tsx` | Update webhook URL + setup instructions |
| `web/src/app/(auth)/` login/register files | Swap Firebase Auth for Supabase Auth |
| Any file importing `firebase/*` | Replace with Supabase equivalents |

### Delete
`functions/`, `apphosting.yaml`, `apphosting.prod.yaml`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `remoteconfig.template.json`

---

## Task 1: Swap Dependencies + Env Vars

**Files:**
- Modify: `web/package.json`
- Modify: `web/.env.example`

- [ ] **Step 1: Remove Firebase, install Supabase**

```bash
cd web
npm uninstall firebase
npm install @supabase/supabase-js @supabase/ssr
```

Expected: `web/node_modules/@supabase/` exists, `firebase` is absent from `package.json` dependencies.

- [ ] **Step 2: Overwrite `web/.env.example`**

Replace the full contents of `web/.env.example`:
```
# Supabase (crm-assistant project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Evolution API (Railway)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=
EVOLUTION_WEBHOOK_SECRET=
EVOLUTION_OWNER_ID=

# App URL (set in Vercel dashboard)
NEXT_PUBLIC_APP_URL=
```

- [ ] **Step 3: Create `web/.env.local` from real values (not committed)**

Copy `.env.example` → `.env.local` and fill in:
- Supabase values: dashboard → Settings → API (project id `jgtznpsxiyrmyxyzyxnv`)
- Evolution API values: set after deploying Evolution API to Railway
- `EVOLUTION_OWNER_ID`: the `auth.users.id` UUID of Pancho's admin account in Supabase
- `EVOLUTION_WEBHOOK_SECRET`: any random secret string (min 32 chars)

Verify `.env.local` is in `.gitignore` — it must never be committed.

- [ ] **Step 4: Commit**

```bash
cd web
git add package.json package-lock.json .env.example
git commit -m "chore: swap firebase for supabase, update env template"
```

---

## Task 2: Supabase Client Modules

**Files:**
- Create: `web/src/lib/supabase/client.ts`
- Create: `web/src/lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

Create `web/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `web/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies set by middleware instead
          }
        },
      },
    }
  );
}

// Service client: bypasses RLS — use ONLY in server-side webhook/API handlers, never in components
export async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd web && npm run type-check
```

Expected: No errors in the two new files. Existing Firebase-import errors are expected and resolved in later tasks.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/supabase/
git commit -m "feat: add supabase browser and server clients"
```

---

## Task 3: Database Migrations

**Files:**
- Create: `docs/migrations/001-evolution-api-fields.sql`
- Apply via Supabase SQL editor (project `crm-assistant`)

- [ ] **Step 1: Apply contacts migration**

In Supabase SQL editor, run:
```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_normalized text;
CREATE INDEX IF NOT EXISTS contacts_phone_normalized_idx ON contacts(phone_normalized);
```

- [ ] **Step 2: Apply conversations migration**

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at DESC);
ALTER TABLE conversations ADD CONSTRAINT conversations_owner_phone_unique
  UNIQUE (owner_id, customer_phone);
```

- [ ] **Step 3: Apply messages migration**

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS evolution_message_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS filename text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_timestamp timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS messages_evolution_message_id_idx
  ON messages(evolution_message_id) WHERE evolution_message_id IS NOT NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','video','document','audio','sticker','note']));
```

- [ ] **Step 4: Create `_dlq` table**

```sql
CREATE TABLE IF NOT EXISTS _dlq (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  source text NOT NULL,
  payload jsonb NOT NULL,
  error text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 5: Verify RLS policies cover all tables**

Run this to see which tables have NO policies (after RLS is enabled):
```sql
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename != '_dlq'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  );
```

Expected: zero rows returned. If any table is listed, add a SELECT policy for that table:
```sql
-- Example for a missing table (adjust table name)
CREATE POLICY "users_see_own_rows" ON <tablename>
  FOR ALL USING (owner_id = auth.uid());
```

- [ ] **Step 6: Verify migrations applied**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'evolution_message_id';
-- Expected: 1 row

SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'conversations' AND constraint_type = 'UNIQUE';
-- Expected: conversations_owner_phone_unique is listed
```

- [ ] **Step 7: Save migration SQL and commit**

Save all SQL from Steps 1–4 into `docs/migrations/001-evolution-api-fields.sql`, then:
```bash
git add docs/migrations/001-evolution-api-fields.sql
git commit -m "chore: add supabase migration SQL for evolution api fields"
```

---

## Task 4: Evolution API Client

**Files:**
- Create: `web/src/lib/evolution-client.ts`

- [ ] **Step 1: Write the full client**

Create `web/src/lib/evolution-client.ts`:
```typescript
const BASE     = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

function headers() {
  return { apikey: API_KEY, 'Content-Type': 'application/json' };
}

async function evoGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Evolution GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function evoPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────

export type ConnectionStatus = 'active' | 'loading' | 'qr' | 'offline' | 'not_configured';

export interface StatusResult {
  status: ConnectionStatus;
  phone?: string;
  name?: string;
  qrCode?: string;
}

export type MediaType = 'image' | 'video' | 'document' | 'audio';

// ── Helpers ──────────────────────────────────────────────

function normalizeState(state: string | undefined): ConnectionStatus {
  switch (state?.toLowerCase()) {
    case 'open':       return 'active';
    case 'connecting': return 'loading';
    case 'close':      return 'qr';
    default:           return 'offline';
  }
}

/** Strip non-digits: "+52 55 1234-5678" → "5215512345678" */
export function toEvolutionNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ── Public API ────────────────────────────────────────────

export async function getInstanceStatus(): Promise<StatusResult> {
  if (!process.env.EVOLUTION_API_KEY) return { status: 'not_configured' };

  try {
    const data = await evoGet<{ instance?: { state?: string } }>(
      `/instance/connectionState/${INSTANCE}`
    );
    const status = normalizeState(data.instance?.state);

    if (status === 'qr') {
      try {
        const qr = await evoGet<{ base64?: string; code?: string }>(
          `/instance/connect/${INSTANCE}`
        );
        return { status: 'qr', qrCode: qr.base64 ?? qr.code };
      } catch {
        return { status: 'qr' };
      }
    }

    return { status };
  } catch {
    return { status: 'offline' };
  }
}

export async function sendText(
  to: string,
  text: string
): Promise<{ key?: { id?: string } }> {
  return evoPost(`/message/sendText/${INSTANCE}`, { number: to, text });
}

export async function sendMedia(
  to: string,
  mediatype: MediaType,
  media: string,
  caption?: string,
  fileName?: string
): Promise<{ key?: { id?: string } }> {
  return evoPost(`/message/sendMedia/${INSTANCE}`, {
    number: to,
    mediatype,
    media,
    ...(caption  ? { caption }  : {}),
    ...(fileName ? { fileName } : {}),
  });
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd web && npm run type-check
```

Expected: No errors in `evolution-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/evolution-client.ts
git commit -m "feat: add evolution api client"
```

---

## Task 5: Webhook Route Handler

**Files:**
- Create: `web/src/app/api/webhooks/evolution/route.ts`

- [ ] **Step 1: Create the file with types and helpers**

Create `web/src/app/api/webhooks/evolution/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// ── Evolution API payload types ──────────────────────────

interface EvolutionKey   { remoteJid: string; fromMe: boolean; id: string; }
interface EvolutionMedia { url?: string; caption?: string; fileName?: string; }
interface EvolutionMsg   {
  conversation?:    string;
  imageMessage?:    EvolutionMedia;
  videoMessage?:    EvolutionMedia;
  documentMessage?: EvolutionMedia;
  audioMessage?:    { url?: string };
  stickerMessage?:  { url?: string };
}
interface EvolutionData  {
  key:               EvolutionKey;
  pushName?:         string;
  message?:          EvolutionMsg;
  messageType?:      string;
  messageTimestamp?: number;
}
interface EvolutionEvent { event: string; data?: EvolutionData; }

// ── Helpers ───────────────────────────────────────────────

function parsePhone(jid: string)     { return jid.split('@')[0]; }
function normalizePhone(p: string)   { return p.replace(/\D/g, ''); }
function isGroup(jid: string)        { return jid.endsWith('@g.us') || jid.includes('-'); }

function extractContent(msg: EvolutionMsg): string {
  return (
    msg.conversation ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    ''
  );
}

function extractMediaUrl(msg: EvolutionMsg): string | null {
  return (
    msg.imageMessage?.url    ??
    msg.videoMessage?.url    ??
    msg.documentMessage?.url ??
    msg.audioMessage?.url    ??
    msg.stickerMessage?.url  ??
    null
  );
}

function toMsgType(t: string): 'text'|'image'|'video'|'document'|'audio'|'sticker' {
  if (t === 'imageMessage')    return 'image';
  if (t === 'videoMessage')    return 'video';
  if (t === 'documentMessage') return 'document';
  if (t === 'audioMessage' || t === 'pttMessage') return 'audio';
  if (t === 'stickerMessage')  return 'sticker';
  return 'text';
}

function toPreview(msg: EvolutionMsg, t: string): string {
  if (msg.conversation)             return msg.conversation;
  if (msg.imageMessage)             return msg.imageMessage.caption || '📷 Imagen';
  if (msg.videoMessage)             return msg.videoMessage.caption || '🎥 Video';
  if (msg.documentMessage)          return `📄 ${msg.documentMessage.fileName ?? 'Documento'}`;
  if (msg.audioMessage)             return '🎤 Audio';
  if (msg.stickerMessage)           return '🎭 Sticker';
  return `[${t}]`;
}
```

- [ ] **Step 2: Add the POST handler (same file, after helpers)**

```typescript
// ── POST handler ─────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify webhook secret (Evolution API sends apikey header)
  const secret = req.headers.get('apikey') ?? req.headers.get('x-webhook-secret');
  if (secret !== process.env.EVOLUTION_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as EvolutionEvent;

  // Only handle message events
  if (body.event !== 'messages.upsert' || !body.data) {
    return NextResponse.json({ ok: true });
  }

  const { key, pushName, message, messageType, messageTimestamp } = body.data;
  if (isGroup(key.remoteJid)) return NextResponse.json({ ok: true });

  const ownerId  = process.env.EVOLUTION_OWNER_ID!;
  const phone    = parsePhone(key.remoteJid);
  const phonNorm = normalizePhone(phone);
  const isOut    = key.fromMe;
  const name     = isOut ? null : (pushName ?? null);
  const rawType  = messageType ?? 'conversation';
  const content  = message ? extractContent(message) : '';
  const preview  = message ? toPreview(message, rawType) : `[${rawType}]`;
  const msgType  = toMsgType(rawType);
  const mediaUrl = message ? extractMediaUrl(message) : null;
  const filename = message?.documentMessage?.fileName ?? null;
  const ts       = messageTimestamp
    ? new Date(messageTimestamp * 1000).toISOString()
    : new Date().toISOString();

  const supabase = await createServiceClient();

  try {
    // 1. Find or create contact
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('owner_id', ownerId)
      .eq('phone_normalized', phonNorm)
      .limit(1)
      .maybeSingle();

    let contactId: string;
    if (existing) {
      contactId = existing.id;
      if (name && !existing.name) {
        await supabase
          .from('contacts')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', contactId);
      }
    } else {
      const { data: created, error: cErr } = await supabase
        .from('contacts')
        .insert({
          owner_id: ownerId,
          name: name ?? phone,
          phone,
          phone_normalized: phonNorm,
          tags: [],
          source: 'whatsapp',
        })
        .select('id')
        .single();
      if (cErr || !created) throw new Error(`Contact insert failed: ${cErr?.message}`);
      contactId = created.id;
    }

    // 2. Find or create conversation (two-step to avoid unread_count reset on upsert)
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('owner_id', ownerId)
      .eq('customer_phone', phone)
      .maybeSingle();

    let convId: string;
    if (!existingConv) {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          owner_id: ownerId,
          customer_phone: phone,
          customer_name: name,
          contact_id: contactId,
          status: 'active',
          ai_enabled: false,
          labels: [],
          channel: 'whatsapp',
          last_message: preview,
          last_message_at: ts,
          unread_count: isOut ? 0 : 1,
        })
        .select('id')
        .single();
      if (convErr || !newConv) throw new Error(`Conversation insert failed: ${convErr?.message}`);
      convId = newConv.id;
    } else {
      convId = existingConv.id;
      await supabase
        .from('conversations')
        .update({
          last_message: preview,
          last_message_at: ts,
          unread_count: isOut
            ? existingConv.unread_count
            : (existingConv.unread_count ?? 0) + 1,
          ...(name ? { customer_name: name } : {}),
        })
        .eq('id', convId);
    }

    // 3. Insert message — unique index on evolution_message_id handles duplicates silently
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: convId,
      role: isOut ? 'assistant' : 'user',
      content,
      message_type: msgType,
      is_internal_note: false,
      evolution_message_id: key.id,
      message_timestamp: ts,
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      ...(filename ? { filename }            : {}),
    });

    // Duplicate key → silent skip; other errors → DLQ
    if (msgErr && !msgErr.code?.includes('23505')) {
      throw new Error(`Message insert failed: ${msgErr.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from('_dlq').insert({
      source: 'evolutionWebhook',
      payload: body as unknown as Record<string, unknown>,
      error: msg,
    });
    // Return 200 so Evolution API doesn't keep retrying
    return NextResponse.json({ ok: true, queued: true });
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd web && npm run type-check
```

Expected: Zero errors in the new file.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/webhooks/
git commit -m "feat: add evolution webhook route handler"
```

---

## Task 6: WhatsApp Status Route

**Files:**
- Create: `web/src/app/api/whatsapp/status/route.ts`
- Modify: `web/src/lib/api.ts` (whapiApi.getStatus)

- [ ] **Step 1: Create the status route**

Create `web/src/app/api/whatsapp/status/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstanceStatus } from '@/lib/evolution-client';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await getInstanceStatus();
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Update `whapiApi.getStatus` in `api.ts`**

In `web/src/lib/api.ts`, find the block that calls `httpsCallable(functions, 'getWhapiStatus')` (or similar) and replace it so `whapiApi.getStatus` now calls the new route:
```typescript
export const whapiApi = {
  async getStatus(): Promise<WhapiStatus> {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
    return res.json() as Promise<WhapiStatus>;
  },
};
```

Keep the `WhapiStatus` type exactly as-is — it already matches `StatusResult` shape `{ status, phone?, name?, qrCode? }`. The settings page QR component needs no changes.

- [ ] **Step 3: Verify types compile**

```bash
cd web && npm run type-check
```

Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/whatsapp/status/ web/src/lib/api.ts
git commit -m "feat: add whatsapp status route, wire to evolution client"
```

---

## Task 7: WhatsApp Send Route

**Files:**
- Create: `web/src/app/api/whatsapp/send/route.ts`

- [ ] **Step 1: Create the send route**

Create `web/src/app/api/whatsapp/send/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendText, sendMedia, toEvolutionNumber, MediaType } from '@/lib/evolution-client';
import { z } from 'zod';

const SendSchema = z.object({
  conversationId: z.string().uuid(),
  content:        z.string().min(1),
  type:           z.enum(['text', 'image', 'video', 'document', 'audio']).default('text'),
  mediaUrl:       z.string().url().optional(),
  filename:       z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate input
  const parsed = SendSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { conversationId, content, type, mediaUrl, filename } = parsed.data;

  const service = await createServiceClient();

  // Get customer phone from conversation
  const { data: conv, error: convErr } = await service
    .from('conversations')
    .select('customer_phone')
    .eq('id', conversationId)
    .single();
  if (convErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const to = toEvolutionNumber(conv.customer_phone);

  try {
    let msgId: string | undefined;

    if (type === 'text') {
      const r = await sendText(to, content);
      msgId = r.key?.id;
    } else {
      if (!mediaUrl) {
        return NextResponse.json({ error: 'mediaUrl required for non-text messages' }, { status: 400 });
      }
      const r = await sendMedia(to, type as MediaType, mediaUrl, content || undefined, filename);
      msgId = r.key?.id;
    }

    // Persist in Supabase
    const { data: msg, error: insertErr } = await service
      .from('messages')
      .insert({
        conversation_id:      conversationId,
        role:                 'assistant',
        content,
        message_type:         type,
        is_internal_note:     false,
        ...(msgId    ? { evolution_message_id: msgId } : {}),
        ...(mediaUrl ? { media_url: mediaUrl }         : {}),
        ...(filename ? { filename }                    : {}),
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await service
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({ id: msg.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd web && npm run type-check
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/whatsapp/send/
git commit -m "feat: add whatsapp send route"
```

---

## Task 8: Auth Migration

**Files:**
- Create: `web/src/middleware.ts`
- Modify: login/register pages in `web/src/app/(auth)/`
- Modify: any component importing `firebase/auth`

- [ ] **Step 1: Create Next.js middleware for session refresh**

Create `web/src/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
```

- [ ] **Step 2: Find all auth-related files**

```bash
grep -rl "signInWithEmailAndPassword\|signOut\|onAuthStateChanged\|getAuth" web/src --include="*.tsx" --include="*.ts"
```

List every file returned.

- [ ] **Step 3: Update login page**

In the login page (from Step 2), replace the Firebase sign-in logic. Keep all existing JSX — only replace the submit handler and imports:

Remove:
```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
```

Add:
```typescript
import { createClient } from '@/lib/supabase/client';
```

Replace the submit handler body:
```typescript
const supabase = createClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { setError(error.message); setLoading(false); return; }
router.push('/dashboard');
router.refresh();
```

- [ ] **Step 4: Update any sign-out calls**

For every `signOut(auth)` call found in Step 2:
```typescript
// Replace:
import { getAuth, signOut } from 'firebase/auth';
await signOut(getAuth());

// With:
import { createClient } from '@/lib/supabase/client';
await createClient().auth.signOut();
```

- [ ] **Step 5: Replace `onAuthStateChanged` listeners**

For every auth state listener found in Step 2:
```typescript
// Replace:
import { getAuth, onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(getAuth(), (user) => { /* ... */ });

// With:
import { createClient } from '@/lib/supabase/client';
const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
  const user = session?.user ?? null;
  /* same callback body, use user */
});
// In cleanup: subscription.unsubscribe();
```

- [ ] **Step 6: Verify type-check passes**

```bash
cd web && npm run type-check
```

Expected: Zero Firebase auth errors remain.

- [ ] **Step 7: Commit**

```bash
git add web/src/middleware.ts web/src/app/
git commit -m "feat: migrate auth from firebase to supabase"
```

---

## Task 9: Data Layer Migration (`api.ts`)

**Files:**
- Modify: `web/src/lib/api.ts`

The existing `api.ts` calls Firebase Cloud Functions via `httpsCallable`. Replace every callable with a direct Supabase query. RLS on all tables automatically scopes results to the authenticated user — no need to manually filter by `owner_id` in SELECT queries.

- [ ] **Step 1: Audit all Firebase callable calls**

```bash
grep -n "httpsCallable\|getFunctions\|firebase" web/src/lib/api.ts
```

List every function name. Each one maps to a Supabase table.

- [ ] **Step 2: Add Supabase import, remove Firebase imports**

At the top of `api.ts`, replace Firebase imports with:
```typescript
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
```

- [ ] **Step 3: Replace conversation functions**

```typescript
export async function getConversations(filters?: {
  status?: string; label?: string; search?: string;
}) {
  let q = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.label)  q = q.contains('labels', [filters.label]);
  if (filters?.search) q = q.ilike('customer_name', `%${filters.search}%`);
  return q;
}

export async function getConversation(id: string) {
  const [convRes, msgsRes] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', id).single(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at'),
  ]);
  return { conversation: convRes.data, messages: msgsRes.data ?? [] };
}

export async function updateConversation(id: string, updates: Partial<{
  status: string; labels: string[]; assigned_to: string | null; ai_enabled: boolean;
}>) {
  return supabase.from('conversations').update(updates).eq('id', id);
}

export async function markAsRead(conversationId: string) {
  return supabase.from('conversations').update({ unread_count: 0 }).eq('id', conversationId);
}
```

- [ ] **Step 4: Replace leads functions**

```typescript
export async function getLeads() {
  return supabase.from('leads').select('*').order('sort_order').order('created_at');
}

export async function createLead(data: {
  name: string; phone?: string; email?: string; stage?: string;
  notes?: string; value?: string; source?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  return supabase.from('leads').insert({ ...data, owner_id: user!.id }).select().single();
}

export async function updateLead(id: string, updates: Partial<{
  name: string; phone: string; stage: string; notes: string;
  value: string; sort_order: number;
}>) {
  return supabase.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteLead(id: string) {
  return supabase.from('leads').delete().eq('id', id);
}
```

- [ ] **Step 5: Replace contacts, templates, quick_responses, and bot_config functions**

```typescript
export async function getContacts() {
  return supabase.from('contacts').select('*').order('name');
}
export async function createContact(data: {
  name: string; phone?: string; email?: string; company?: string; tags?: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  return supabase.from('contacts').insert({ ...data, owner_id: user!.id }).select().single();
}
export async function updateContact(id: string, updates: Partial<{
  name: string; phone: string; email: string; company: string; tags: string[];
}>) {
  return supabase.from('contacts').update(updates).eq('id', id);
}

export async function getTemplates() {
  return supabase.from('templates').select('*').eq('is_active', true).order('name');
}

export async function getQuickResponses() {
  return supabase.from('quick_responses').select('*').order('sort_order').order('title');
}

export async function getBotConfig() {
  return supabase.from('bot_config').select('*').eq('id', 1).single();
}
export async function updateBotConfig(updates: Partial<{
  bot_enabled: boolean; bot_name: string; welcome_message: string; business_hours: object;
}>) {
  return supabase.from('bot_config').update(updates).eq('id', 1);
}

export async function getBotTraining() {
  return supabase.from('bot_training').select('*').order('created_at');
}
```

- [ ] **Step 6: Remove all remaining Firebase imports from `api.ts`**

```bash
grep -n "firebase" web/src/lib/api.ts
```

Expected: zero results. Delete any remaining Firebase lines.

- [ ] **Step 7: Verify type-check passes**

```bash
cd web && npm run type-check
```

Expected: Zero errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat: migrate api.ts data layer to supabase"
```

---

## Task 10: Realtime Subscriptions

**Files:**
- Modify: every component that uses Firestore `onSnapshot`

- [ ] **Step 1: Find all Firestore listeners**

```bash
grep -rn "onSnapshot" web/src --include="*.tsx" --include="*.ts"
```

List every file and which collection it listens to.

- [ ] **Step 2: Replace messages listener**

For any component subscribing to messages in a conversation, replace the `onSnapshot` pattern:
```typescript
import { createClient } from '@/lib/supabase/client';

// Inside a useEffect (conversationId is the dependency):
const supabase = createClient();
const channel = supabase
  .channel(`messages:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event:  'INSERT',
      schema: 'public',
      table:  'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      setMessages((prev) => [...prev, payload.new as Message]);
    }
  )
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

- [ ] **Step 3: Replace conversations list listener**

For any component subscribing to the conversations list:
```typescript
const channel = supabase
  .channel('conversations-list')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'conversations' },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setConversations((prev) => [payload.new as Conversation, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setConversations((prev) =>
          prev.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c)
        );
      }
    }
  )
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

- [ ] **Step 4: Verify type-check passes**

```bash
cd web && npm run type-check
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat: replace firestore listeners with supabase realtime"
```

---

## Task 11: Update WhatsApp Settings Page

**Files:**
- Modify: `web/src/app/(dashboard)/settings/whatsapp/page.tsx`

- [ ] **Step 1: Update `getWebhookUrl` function**

In `page.tsx`, replace the `getWebhookUrl` function:
```typescript
function getWebhookUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/webhooks/evolution`;
}
```

- [ ] **Step 2: Update the "not_configured" card**

Replace the card content that mentions `whapi.cloud` and `WHAPI_API_TOKEN`:
```tsx
{status === 'not_configured' && (
  <Card className="border-orange-200 bg-orange-50">
    <CardHeader>
      <CardTitle className="text-base text-orange-800">Configuración requerida</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 text-sm text-orange-700">
      <p>Para activar WhatsApp configura estas variables en Vercel:</p>
      <ol className="ml-4 list-decimal space-y-1">
        <li>Despliega <strong>Evolution API</strong> en Railway (plantilla oficial disponible en evolutionapi.com)</li>
        <li>Copia la URL de Railway → <code className="rounded bg-orange-100 px-1">EVOLUTION_API_URL</code></li>
        <li>Copia la API Key → <code className="rounded bg-orange-100 px-1">EVOLUTION_API_KEY</code></li>
        <li>Define un nombre de instancia (ej. <em>pancho-dapa-crm</em>) → <code className="rounded bg-orange-100 px-1">EVOLUTION_INSTANCE_NAME</code></li>
        <li>Define un secreto para webhooks → <code className="rounded bg-orange-100 px-1">EVOLUTION_WEBHOOK_SECRET</code></li>
        <li>En Evolution API, configura el webhook apuntando a la URL mostrada arriba</li>
        <li>Re-despliega en Vercel — el QR aparecerá aquí para escanear</li>
      </ol>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Update the webhook card description**

Find the `CardDescription` that mentions "whapi.cloud" and replace:
```tsx
<CardDescription>
  Configura esta URL en Evolution API (Railway → Instancia → Webhooks) para recibir mensajes entrantes.
</CardDescription>
```

- [ ] **Step 4: Verify type-check passes**

```bash
cd web && npm run type-check
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/\(dashboard\)/settings/whatsapp/
git commit -m "feat: update whatsapp settings page for evolution api"
```

---

## Task 12: Firebase Teardown

**Files:**
- Delete: `functions/`, all Firebase config files at repo root

- [ ] **Step 1: Confirm zero Firebase imports remain in `web/src`**

```bash
grep -r "from 'firebase" web/src --include="*.ts" --include="*.tsx"
```

Expected: **zero results.** If any remain, fix them before continuing — do not delete Firebase files until all imports are gone.

- [ ] **Step 2: Final type-check and build**

```bash
cd web && npm run type-check && npm run build
```

Expected: Zero type errors. Build succeeds. (Warnings about missing env vars are fine — they will be set in Vercel.)

- [ ] **Step 3: Delete Firebase and Cloud Functions files**

```bash
rm -rf functions/
rm -f apphosting.yaml apphosting.prod.yaml
rm -f firebase.json firestore.rules firestore.indexes.json
rm -f storage.rules remoteconfig.template.json
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove firebase, cloud functions, and whapi — migration complete"
```

---

## Post-Migration Checklist

Before shipping to Vercel:

- [ ] Set all env vars in Vercel dashboard (from `web/.env.example`)
- [ ] Deploy Evolution API to Railway, configure webhook URL to `https://<your-vercel-app>/api/webhooks/evolution` with the `EVOLUTION_WEBHOOK_SECRET` as the apikey header
- [ ] Scan QR code on `/settings/whatsapp` to activate WhatsApp session
- [ ] Send a test WhatsApp message and verify it appears in `/conversations`
- [ ] Send a reply from the CRM and verify it arrives on WhatsApp
- [ ] Verify Realtime works: open two browser tabs on `/conversations`, trigger a new message, confirm both tabs update

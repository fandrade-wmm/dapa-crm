import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getMediaUrl, downloadMetaMedia, type WorkspaceCreds } from '@/lib/meta-client';
import crypto from 'crypto';

// ── Meta Cloud API payload types ──────────────────────────────

interface MetaProfile  { name: string; }
interface MetaContact  { profile: MetaProfile; wa_id: string; }
interface MetaTextMsg  { body: string; }
interface MetaMediaMsg { id: string; caption?: string; filename?: string; mime_type?: string; }

interface MetaMessage {
  from:      string;
  id:        string;
  timestamp: string;
  type:      string;
  text?:     MetaTextMsg;
  image?:    MetaMediaMsg;
  video?:    MetaMediaMsg;
  document?: MetaMediaMsg;
  audio?:    MetaMediaMsg;
  sticker?:  MetaMediaMsg;
}

interface MetaValue {
  messaging_product: string;
  metadata:  { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: unknown[];
}

interface MetaChange { value: MetaValue; field: string; }
interface MetaEntry  { id: string; changes: MetaChange[]; }
interface MetaPayload { object: string; entry: MetaEntry[]; }

// ── Helpers ───────────────────────────────────────────────────

function toMsgType(t: string): 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' {
  if (t === 'image')                  return 'image';
  if (t === 'video')                  return 'video';
  if (t === 'document')               return 'document';
  if (t === 'audio' || t === 'voice') return 'audio';
  if (t === 'sticker')                return 'sticker';
  return 'text';
}

function extractContent(msg: MetaMessage): string {
  return (
    msg.text?.body        ??
    msg.image?.caption    ??
    msg.video?.caption    ??
    msg.document?.caption ??
    ''
  );
}

function toPreview(msg: MetaMessage): string {
  if (msg.text)     return msg.text.body;
  if (msg.image)    return msg.image.caption    || '📷 Imagen';
  if (msg.video)    return msg.video.caption    || '🎥 Video';
  if (msg.document) return `📄 ${msg.document.filename ?? msg.document.caption ?? 'Documento'}`;
  if (msg.audio)    return '🎤 Audio';
  if (msg.sticker)  return '🎭 Sticker';
  return `[${msg.type}]`;
}

function getMediaObj(msg: MetaMessage): MetaMediaMsg | null {
  return msg.image ?? msg.video ?? msg.document ?? msg.audio ?? msg.sticker ?? null;
}

function verifySignature(rawBody: string, sigHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!sigHeader || !appSecret) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  const a = Buffer.from(sigHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Workspace lookup ──────────────────────────────────────────

interface WorkspaceRow {
  id:                   string;
  owner_id:             string;
  meta_access_token:    string | null;
  meta_phone_number_id: string | null;
}

// ── GET — webhook verification ────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env.META_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST — incoming messages ──────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body for HMAC verification
  const rawBody = await req.text();
  const sig     = req.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: MetaPayload;
  try {
    payload = JSON.parse(rawBody) as MetaPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createServiceClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const { value } = change;
      if (!value.messages?.length) continue;

      // 2. Route to the right workspace by phone_number_id
      const phoneNumberId = value.metadata.phone_number_id;
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, owner_id, meta_access_token, meta_phone_number_id')
        .eq('meta_phone_number_id', phoneNumberId)
        .maybeSingle() as { data: WorkspaceRow | null };

      // Fall back to env vars if no workspace matches (single-tenant / dev mode)
      const ownerId = workspace?.owner_id ?? process.env.META_OWNER_ID!;
      const creds: WorkspaceCreds | undefined = workspace?.meta_access_token
        ? { phoneNumberId, accessToken: workspace.meta_access_token }
        : undefined;

      if (!ownerId) {
        // Can't attribute this message — log to DLQ and skip
        await supabase.from('_dlq').insert({
          source:  'metaWebhook',
          payload: { phoneNumberId } as unknown as Record<string, unknown>,
          error:   `No workspace found for phone_number_id: ${phoneNumberId}`,
        });
        continue;
      }

      // Build name lookup from contacts array
      const nameMap: Record<string, string> = {};
      for (const c of value.contacts ?? []) {
        nameMap[c.wa_id] = c.profile.name;
      }

      for (const msg of value.messages) {
        try {
          const phone    = msg.from;
          const name     = nameMap[phone] ?? null;
          const msgType  = toMsgType(msg.type);
          const content  = extractContent(msg);
          const preview  = toPreview(msg);
          const ts       = new Date(Number(msg.timestamp) * 1000).toISOString();

          // 3. Download media → re-upload to Supabase Storage
          let mediaUrl: string | null = null;
          const mediaObj = getMediaObj(msg);
          if (mediaObj?.id) {
            try {
              const tempUrl = await getMediaUrl(mediaObj.id, creds);
              const { buffer, contentType } = await downloadMetaMedia(tempUrl, creds);
              const ext  = contentType.split('/')[1]?.split(';')[0] ?? 'bin';
              const path = `whatsapp/${msg.id}.${ext}`;
              const { data: up } = await supabase.storage
                .from('media')
                .upload(path, buffer, { contentType, upsert: true });
              if (up) {
                const { data: pub } = supabase.storage.from('media').getPublicUrl(up.path);
                mediaUrl = pub.publicUrl;
              }
            } catch {
              // Non-fatal: store message without media URL
            }
          }

          const filename = msg.document?.filename ?? null;

          // 4. Upsert contact
          const { data: existing } = await supabase
            .from('contacts')
            .select('id, name')
            .eq('owner_id', ownerId)
            .eq('phone_normalized', phone)
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
                owner_id:         ownerId,
                name:             name ?? phone,
                phone,
                phone_normalized: phone,
                tags:             [],
                source:           'whatsapp',
              })
              .select('id')
              .single();
            if (cErr || !created) throw new Error(`Contact insert failed: ${cErr?.message}`);
            contactId = created.id;
          }

          // 5. Upsert conversation
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
                owner_id:        ownerId,
                customer_phone:  phone,
                customer_name:   name,
                contact_id:      contactId,
                status:          'active',
                ai_enabled:      false,
                labels:          [],
                channel:         'whatsapp',
                last_message:    preview,
                last_message_at: ts,
                unread_count:    1,
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
                last_message:    preview,
                last_message_at: ts,
                unread_count:    (existingConv.unread_count ?? 0) + 1,
                ...(name ? { customer_name: name } : {}),
              })
              .eq('id', convId);
          }

          // 6. Insert message (dedup on meta_message_id)
          const { error: msgErr } = await supabase.from('messages').insert({
            conversation_id:   convId,
            role:              'user',
            content,
            message_type:      msgType,
            is_internal_note:  false,
            meta_message_id:   msg.id,
            message_timestamp: ts,
            ...(mediaUrl ? { media_url: mediaUrl } : {}),
            ...(filename  ? { filename }            : {}),
          });

          if (msgErr && !msgErr.code?.includes('23505')) {
            throw new Error(`Message insert failed: ${msgErr.message}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await supabase.from('_dlq').insert({
            source:  'metaWebhook',
            payload: msg as unknown as Record<string, unknown>,
            error:   errMsg,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

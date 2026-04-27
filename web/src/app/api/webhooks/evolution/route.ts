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

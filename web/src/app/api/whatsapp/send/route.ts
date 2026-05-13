import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendText, sendMedia, toE164, type MetaMediaType, type WorkspaceCreds } from '@/lib/meta-client';
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

  // Get workspace credentials for this user
  const { data: profile } = await service
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single();

  let creds: WorkspaceCreds | undefined;
  if (profile?.workspace_id) {
    const { data: workspace } = await service
      .from('workspaces')
      .select('meta_phone_number_id, meta_access_token')
      .eq('id', profile.workspace_id)
      .single();
    if (workspace?.meta_phone_number_id && workspace?.meta_access_token) {
      creds = {
        phoneNumberId: workspace.meta_phone_number_id,
        accessToken:   workspace.meta_access_token,
      };
    }
  }

  // Get customer phone from conversation
  const { data: conv, error: convErr } = await service
    .from('conversations')
    .select('customer_phone')
    .eq('id', conversationId)
    .single();
  if (convErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const to = toE164(conv.customer_phone);

  try {
    let metaMsgId: string | undefined;

    if (type === 'text') {
      const r = await sendText(to, content, creds);
      metaMsgId = r.id;
    } else {
      if (!mediaUrl) {
        return NextResponse.json({ error: 'mediaUrl required for non-text messages' }, { status: 400 });
      }
      const r = await sendMedia(to, type as MetaMediaType, mediaUrl, content || undefined, filename, creds);
      metaMsgId = r.id;
    }

    // Persist in Supabase
    const { data: msg, error: insertErr } = await service
      .from('messages')
      .insert({
        conversation_id:   conversationId,
        role:              'assistant',
        content,
        message_type:      type,
        is_internal_note:  false,
        ...(metaMsgId ? { meta_message_id: metaMsgId } : {}),
        ...(mediaUrl  ? { media_url: mediaUrl }         : {}),
        ...(filename  ? { filename }                    : {}),
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

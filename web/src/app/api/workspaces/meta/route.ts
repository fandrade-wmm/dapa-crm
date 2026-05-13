/**
 * PUT /api/workspaces/meta
 * Admin-only: save Meta WhatsApp credentials for the current user's workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MetaCredsSchema = z.object({
  metaPhoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  metaWabaId:        z.string().optional(),
  metaAccessToken:   z.string().min(1, 'Access Token is required'),
});

export async function PUT(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify admin role
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admins only' }, { status: 403 });
  }
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: 'No workspace found for this user' }, { status: 400 });
  }

  // 3. Validate body
  const parsed = MetaCredsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { metaPhoneNumberId, metaWabaId, metaAccessToken } = parsed.data;

  // 4. Update workspace
  const { error: updateErr } = await service
    .from('workspaces')
    .update({
      meta_phone_number_id: metaPhoneNumberId,
      meta_waba_id:         metaWabaId ?? null,
      meta_access_token:    metaAccessToken,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', profile.workspace_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify the caller is authenticated
    const userClient = await createClient();
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is admin
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // 3. Parse body
    const { email, displayName, role = 'agent', permissions } = (await req.json()) as {
      email: string;
      displayName: string;
      role?: 'admin' | 'agent';
      permissions?: Record<string, boolean>;
    };

    if (!email?.trim() || !displayName?.trim()) {
      return NextResponse.json({ error: 'email and displayName required' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('origin') ?? '';

    // 4. Invite via Supabase Admin (service role)
    const admin = await createServiceClient();
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/login`,
      data: { display_name: displayName, role },
    });
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    // 5. Upsert profile row so the team page shows it immediately
    const defaultPerms = {
      conversations: true,
      crm: false,
      automations: false,
      quickResponses: true,
      settings: false,
      ...permissions,
    };
    await admin.from('profiles').upsert({
      id: inviteData.user.id,
      email,
      display_name: displayName,
      role,
      permissions: defaultPerms,
      is_active: true,
    });

    // 6. Build the invite link — Supabase doesn't expose it directly via admin SDK,
    //    but the email sent by Supabase contains the link. We return a confirmation URL
    //    the admin can share as a fallback.
    const inviteLink = `${appUrl}/login`;

    return NextResponse.json({ ok: true, inviteLink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

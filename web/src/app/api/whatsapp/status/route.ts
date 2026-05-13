import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPhoneStatus, type WorkspaceCreds } from '@/lib/meta-client';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up workspace credentials for this user
  const service = await createServiceClient();
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

  const result = await getPhoneStatus(creds);
  return NextResponse.json(result);
}

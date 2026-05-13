import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPhoneStatus } from '@/lib/meta-client';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await getPhoneStatus();
  return NextResponse.json(result);
}

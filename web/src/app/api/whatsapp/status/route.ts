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

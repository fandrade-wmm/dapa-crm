import { createClient } from '@/lib/supabase/client';
import type { User } from './types';

export async function getUserById(uid: string): Promise<User> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error || !data) throw new Error('User not found');
  return {
    uid:         data.id,
    email:       data.email,
    displayName: data.display_name ?? null,
    photoURL:    null,
    role:        data.role,
    isActive:    data.is_active ?? true,
    createdAt:   data.created_at,
    workspaceId: data.workspace_id ?? null,
  };
}

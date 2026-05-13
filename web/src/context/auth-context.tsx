'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getUserById } from '@/lib/user-service';
import type { User, Workspace } from '@/lib/types';

interface AuthContextValue {
  user:      SupabaseUser | null;
  profile:   User | null;
  workspace: Workspace | null;
  loading:   boolean;
  signOut:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:      null,
  profile:   null,
  workspace: null,
  loading:   true,
  signOut:   async () => {},
});

async function fetchWorkspace(workspaceId: string): Promise<Workspace | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  if (error || !data) return null;
  return {
    id:                data.id,
    name:              data.name,
    ownerId:           data.owner_id ?? null,
    metaPhoneNumberId: data.meta_phone_number_id ?? null,
    metaWabaId:        data.meta_waba_id ?? null,
    metaAccessToken:   data.meta_access_token ?? null,
    createdAt:         data.created_at,
    updatedAt:         data.updated_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<SupabaseUser | null>(null);
  const [profile,   setProfile]   = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading,   setLoading]   = useState(true);

  async function loadUser(u: SupabaseUser) {
    try {
      const p = await getUserById(u.id);
      setProfile(p);
      if (p.workspaceId) {
        const ws = await fetchWorkspace(p.workspaceId);
        setWorkspace(ws);
      } else {
        setWorkspace(null);
      }
    } catch {
      setProfile(null);
      setWorkspace(null);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) {
        loadUser(u).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadUser(u);
      } else {
        setProfile(null);
        setWorkspace(null);
      }
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, workspace, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { signOut } from '@/lib/auth-service';
import { useAuth } from '@/hooks/use-auth';

export function Header() {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{user.displayName ?? user.email}</span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </header>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordReset } from '@/lib/auth-service';

type State = 'idle' | 'loading' | 'success' | 'error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setState('loading');
    setErrorMsg(null);

    try {
      await sendPasswordReset(email.trim());
      setState('success');
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      // Don't reveal whether the account exists — show generic message
      setState('success');
    }
  }

  const inputCls =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  const btnCls =
    'inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  return (
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">CRM Assistant</h1>
        <p className="text-muted-foreground">Reset your password</p>
      </div>

      {state === 'success' ? (
        <div className="space-y-4 text-center">
          {/* Success illustration */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{email}</span> is registered, you
              will receive a password reset link shortly.
            </p>
          </div>
          <Link
            href="/login"
            className="block text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground text-center">
            Enter the email address associated with your account and we&apos;ll send you a reset
            link.
          </p>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-sm font-medium leading-none">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={state === 'loading'} className={btnCls}>
              {state === 'loading' ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

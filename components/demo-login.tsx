'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { postJson } from '@/lib/client-api';

export function DemoLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await postJson('/api/demo/login', { secret });
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
      <form onSubmit={submit} className="glass flex flex-col gap-3 p-5">
        <h1 className="text-xl font-bold">โหมดสาธิต</h1>
        <label>
          รหัสสาธิต
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="field mt-1"
          />
        </label>
        {error && (
          <p role="alert" className="text-urgent-text">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          เข้าสู่โหมดสาธิต
        </button>
      </form>
    </main>
  );
}

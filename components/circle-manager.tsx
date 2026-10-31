'use client';

import { useState } from 'react';
import { postJson } from '@/lib/client-api';

const ROLES = [
  { role: 'INNER', label: 'เชิญวงใน' },
  { role: 'BACKUP', label: 'เชิญ อสม. / ผู้ดูแล' },
  { role: 'FAMILY', label: 'เชิญลูกหลาน' },
] as const;

/** Family-only: invite links per role and the BACKUP circle switch. */
export function CircleManager({
  elderId,
  backupEnabled,
}: {
  elderId: string;
  backupEnabled: boolean;
}) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [backup, setBackup] = useState(backupEnabled);
  const [error, setError] = useState<string | null>(null);

  async function invite(role: string) {
    setError(null);
    const result = await postJson<{ url: string }>(
      `/api/liff/elder/${elderId}/invites`,
      { role },
    );
    if (result.ok) setLinks((all) => ({ ...all, [role]: result.url }));
    else setError(result.error);
  }

  async function toggleBackup() {
    const next = !backup;
    setError(null);
    const result = await postJson(`/api/liff/elder/${elderId}/backup`, {
      backupEnabled: next,
    });
    if (result.ok) setBackup(next);
    else setError(result.error);
  }

  return (
    <section className="glass p-4">
      <h2 className="mb-2 font-bold">ชวนคนเข้าวง</h2>
      <div className="flex flex-col gap-2">
        {ROLES.map(({ role, label }) => (
          <div key={role}>
            <button type="button" onClick={() => invite(role)} className="btn btn-soft">
              {label}
            </button>
            {links[role] && (
              <input
                readOnly
                aria-label={`ลิงก์${label}`}
                value={links[role]}
                onFocus={(event) => event.target.select()}
                className="field mt-1.5 text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">ลิงก์ใช้ได้ครั้งเดียว ภายใน 7 วัน</p>
      <label className="mt-3 flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={backup}
          onChange={toggleBackup}
          className="size-5 accent-primary"
        />
        แจ้งวงสำรอง (อสม. / ผู้ดูแล) ด้วย
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-urgent-text">
          {error}
        </p>
      )}
    </section>
  );
}

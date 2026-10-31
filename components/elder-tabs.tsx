'use client';

import { Key, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { ElderView } from '@/lib/views';
import { clock, shortDate } from '@/lib/time';
import { CircleManager } from './circle-manager';

const TABS = ['ยาและสุขภาพ', 'ประวัติล้ม', 'วงคนช่วย'] as const;
const ROLE_LABEL = { FAMILY: 'ลูกหลาน', INNER: 'วงใน', BACKUP: 'วงสำรอง' };

const OUTCOME: Record<string, string> = {
  RESOLVED: 'ช่วยเหลือแล้ว',
  CANCELLED_SELF: 'ลุกได้เอง',
  CLOSED_BY_FAMILY: 'ครอบครัวปิดเหตุการณ์',
};

function Health({ elder }: { elder: ElderView }) {
  const data = elder.private;
  if (!data) {
    return (
      <p className="glass p-5 text-muted">
        ข้อมูลสุขภาพแสดงเฉพาะลูกหลาน วงใน และคนที่กำลังรับงานอยู่เท่านั้น
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <section className="glass p-4">
        <h2 className="mb-2 font-bold">ยาที่กินประจำ · {data.medications.length}</h2>
        {data.medications.length === 0 && <p className="text-muted">ยังไม่ได้กรอก</p>}
        <ul className="divide-y divide-ink/8">
          {data.medications.map((medication) => (
            <li key={medication.id} className="py-2.5">
              <p className="font-semibold">{medication.name}</p>
              <p className="text-sm text-muted">{medication.schedule}</p>
              {medication.warning && (
                <p className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-urgent-soft p-2 text-sm font-semibold text-urgent-text">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {medication.warning}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="glass p-4">
        <h2 className="font-bold">โรคประจำตัว</h2>
        <p className="text-muted">
          {data.conditions.join(', ') || 'ยังไม่ได้กรอก'}
        </p>
        <h2 className="mt-3 font-bold">แพ้ยา</h2>
        <p className="text-muted">{data.allergies || 'ยังไม่ได้กรอก'}</p>
      </section>
      <section className="glass p-4">
        <h2 className="font-bold">ล้ม {elder.recentFalls} ครั้งใน 30 วัน</h2>
        {elder.recentFalls >= 2 && (
          <p className="text-sm text-muted">แนะนำให้ลูกหลานพาไปพบแพทย์</p>
        )}
      </section>
      <p className="flex items-center gap-2 px-1 text-sm text-muted">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        คุณเห็นข้อมูลนี้เพราะอยู่ในวงในของ{elder.title}
      </p>
    </div>
  );
}

export function ElderTabs({ elder }: { elder: ElderView }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  return (
    <>
      <div role="tablist" className="glass mt-3 mb-3 flex gap-1 rounded-full p-1">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${tab === name ? 'bg-primary-text text-white' : 'text-muted'}`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'ยาและสุขภาพ' && <Health elder={elder} />}

      {tab === 'ประวัติล้ม' && (
        <ul className="glass divide-y divide-ink/8 px-4">
          {elder.falls.length === 0 && (
            <li className="py-4 text-muted">ยังไม่มีประวัติล้ม</li>
          )}
          {elder.falls.map((fall) => (
            <li key={fall.id} className="flex justify-between gap-3 py-3">
              <span className="font-semibold">
                {shortDate(new Date(fall.detectedAt))} · {clock(new Date(fall.detectedAt))} น.
              </span>
              <span className="text-sm text-muted">
                {OUTCOME[fall.status] ?? 'กำลังดำเนินการ'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tab === 'วงคนช่วย' && (
        <div className="flex flex-col gap-3">
          <ul className="glass divide-y divide-ink/8 px-4">
            {elder.circle.map((member) => (
              <li key={member.id} className="flex min-h-14 items-center gap-2">
                <span className="flex-1 font-semibold">{member.displayName}</span>
                {member.hasKey && (
                  <Key className="size-4 text-primary-text" aria-label="มีกุญแจสำรอง" />
                )}
                <span className="text-sm text-muted">{ROLE_LABEL[member.role]}</span>
              </li>
            ))}
          </ul>
          {elder.viewerRole === 'FAMILY' && (
            <CircleManager elderId={elder.id} backupEnabled={elder.backupEnabled} />
          )}
        </div>
      )}
    </>
  );
}

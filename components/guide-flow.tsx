'use client';

import { Check, Phone, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMS,
  GUIDE_DISCLAIMER,
  STEPS,
  STEP_1,
  STEP_2,
  STEP_3,
  STEP_4,
  STEP_5,
  buildEmsScript,
  fillTitle,
} from '@/content/guide.th';
import { postJson } from '@/lib/client-api';

type Saved = {
  step: number;
  safetyChecks: string[];
  redFlags: string[];
  moves: string[];
  watchChecks: string[];
  emsTriggered: boolean;
};

export type GuideElder = {
  title: string;
  sex: 'FEMALE' | 'MALE';
  age: number;
  address: string;
  room: string;
  keyMedications: string[];
};

const EMPTY: Saved = {
  step: 1,
  safetyChecks: [],
  redFlags: [],
  moves: [],
  watchChecks: [],
  emsTriggered: false,
};

const toggled = (list: string[], item: string) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

function Checks({
  items,
  selected,
  onToggle,
  tone = 'blue',
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  tone?: 'blue' | 'orange';
}) {
  const on =
    tone === 'blue'
      ? 'border-primary bg-primary-soft'
      : 'border-urgent bg-urgent-soft';
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const checked = selected.includes(item);
        return (
          <li key={item}>
            <label
              className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[20px] border bg-white/85 p-3.5 text-left font-semibold has-focus-visible:outline-3 has-focus-visible:outline-primary ${checked ? on : 'border-ink/10'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item)}
                className="sr-only"
              />
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-transparent bg-ink text-white' : 'border-ink/25'}`}
              >
                {checked && <Check className="size-4" aria-hidden />}
              </span>
              {item}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The first-response guide. With `incidentId` it saves progress and tells the
 * family when the helper reaches the EMS screen; without one it is the practice
 * mode from the menu, which changes nothing on the server.
 */
export function GuideFlow({
  incidentId,
  elder,
  initial,
  doneHref,
}: {
  incidentId?: string;
  elder: GuideElder;
  initial?: Saved | null;
  doneHref: string;
}) {
  const [saved, setSaved] = useState<Saved>(initial ?? EMPTY);
  const [reached, setReached] = useState(initial?.step ?? 1);
  const [ems, setEms] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const firstRender = useRef(true);
  const { step, safetyChecks, redFlags, moves, watchChecks } = saved;
  const t = useCallback((text: string) => fillTitle(text, elder.title), [elder.title]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!incidentId) return;
    let stale = false;
    void postJson(`/api/liff/incident/${incidentId}/guide`, saved).then(
      (result) => {
        if (!stale) setSaveFailed(!result.ok);
      },
    );
    return () => {
      stale = true;
    };
  }, [incidentId, saved]);

  const update = (patch: Partial<Saved>) =>
    setSaved((current) => ({ ...current, ...patch }));

  function goTo(next: number) {
    setEms(false);
    setNotReady(false);
    setReached((value) => Math.max(value, next));
    update({ step: next });
    window.scrollTo({ top: 0 });
  }

  function openEms() {
    setEms(true);
    update({ emsTriggered: true });
    window.scrollTo({ top: 0 });
  }

  const script = buildEmsScript({
    sex: elder.sex,
    age: elder.age,
    room: elder.room,
    address: elder.address,
    keyMedications: elder.keyMedications,
    flags: redFlags,
  });

  return (
    <>
      <nav aria-label="ขั้นตอน" className="glass flex justify-between p-2">
        {STEPS.map(({ number, label }) => {
          const current = number === step && !ems;
          const done = number < reached || (number === reached && number !== step);
          const reachable = number <= reached;
          return (
            <button
              key={number}
              type="button"
              disabled={!reachable}
              aria-current={current ? 'step' : undefined}
              onClick={() => goTo(number)}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm ${current ? 'bg-primary-text text-white' : done ? 'bg-primary-soft text-primary-text' : 'bg-ink/5 text-muted'}`}
              >
                {done && !current ? <Check className="size-4" aria-label="เสร็จแล้ว" /> : number}
              </span>
              <span className={current ? 'text-ink' : 'text-muted'}>{label}</span>
            </button>
          );
        })}
      </nav>

      <section className="glass flex-1 p-5">
        {ems ? (
          <>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-urgent-text">
              <TriangleAlert className="size-7 shrink-0" aria-hidden />
              {t(EMS.heading)}
            </h2>
            <a href="tel:1669" className="btn btn-lg btn-urgent mt-4">
              <Phone className="size-5" aria-hidden /> {EMS.call}
            </a>
            <h3 className="mt-5 font-bold">{EMS.scriptLabel}</h3>
            <p data-testid="ems-script" className="mt-2 rounded-[20px] bg-urgent-soft p-4 leading-relaxed font-semibold">
              {script}
            </p>
            <h3 className="mt-5 font-bold">{EMS.waitingLabel}</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {EMS.waiting.map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-1">
              <Link href={doneHref} className="btn btn-primary">
                {EMS.finish}
              </Link>
              <button type="button" onClick={() => setEms(false)} className="btn btn-quiet">
                {EMS.back}
              </button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h2 className="text-2xl font-bold">{STEP_1.heading}</h2>
            <p className="mt-1 mb-4 text-muted">{t(STEP_1.why)}</p>
            <Checks
              items={STEP_1.checks}
              selected={safetyChecks}
              onToggle={(item) => update({ safetyChecks: toggled(safetyChecks, item) })}
            />
            <button type="button" onClick={() => goTo(2)} className="btn btn-lg btn-primary mt-5">
              {STEP_1.next}
            </button>
          </>
        ) : step === 2 ? (
          <>
            <h2 className="text-2xl font-bold">{t(STEP_2.heading)}</h2>
            <p className="my-3 rounded-[20px] bg-primary-soft p-4 text-lg font-semibold">
              “{STEP_2.ask}”
            </p>
            <h3 className="mb-2 font-bold">{STEP_2.flagsLabel}</h3>
            <Checks
              tone="orange"
              items={STEP_2.flags}
              selected={redFlags}
              onToggle={(item) => update({ redFlags: toggled(redFlags, item) })}
            />
            {redFlags.length > 0 ? (
              <button type="button" onClick={openEms} className="btn btn-lg btn-urgent mt-5">
                {STEP_2.hasFlags}
              </button>
            ) : (
              <button type="button" onClick={() => goTo(3)} className="btn btn-lg btn-primary mt-5">
                {STEP_2.noFlags}
              </button>
            )}
          </>
        ) : step === 3 ? (
          <>
            <h2 className="text-2xl font-bold">{t(STEP_3.heading)}</h2>
            <p className="my-3 rounded-[20px] bg-primary-soft p-4 text-lg font-semibold">
              “{t(STEP_3.ask)}”
            </p>
            {notReady && (
              <output className="block mb-3 rounded-[20px] bg-urgent-soft p-4 font-semibold">
                {STEP_3.rest}
              </output>
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => goTo(4)} className="btn btn-lg btn-primary">
                {STEP_3.ready}
              </button>
              <button type="button" onClick={() => setNotReady(true)} className="btn btn-soft">
                {STEP_3.notReady}
              </button>
            </div>
          </>
        ) : step === 4 ? (
          <>
            <h2 className="text-2xl font-bold">{STEP_4.heading}</h2>
            <p className="mt-2 mb-4 flex items-center gap-2 rounded-[20px] bg-urgent-soft p-3.5 font-bold text-urgent-text">
              <TriangleAlert className="size-5 shrink-0" aria-hidden />
              {STEP_4.stop}
            </p>
            <Checks
              items={STEP_4.moves}
              selected={moves}
              onToggle={(item) => update({ moves: toggled(moves, item) })}
            />
            <button type="button" onClick={() => goTo(5)} className="btn btn-lg btn-primary mt-5">
              {STEP_4.next}
            </button>
            <button type="button" onClick={openEms} className="btn btn-quiet mt-1 text-urgent-text">
              {STEP_4.cannot}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">{STEP_5.heading}</h2>
            <div className="mt-4">
              <Checks
                items={STEP_5.checks}
                selected={watchChecks}
                onToggle={(item) => update({ watchChecks: toggled(watchChecks, item) })}
              />
            </div>
            <p className="mt-4 rounded-[20px] bg-urgent-soft p-3.5 font-bold text-urgent-text">
              {STEP_5.warn}
            </p>
            <a href="tel:1669" className="btn btn-soft mt-3">
              <Phone className="size-5" aria-hidden /> โทร 1669
            </a>
            <Link href={doneHref} className="btn btn-lg btn-primary mt-2">
              {STEP_5.next}
            </Link>
          </>
        )}
      </section>

      {saveFailed && (
        <p role="alert" className="text-center text-sm text-urgent-text">
          บันทึกความคืบหน้าไม่สำเร็จ คู่มือยังใช้ต่อได้
        </p>
      )}
      <footer className="pb-2 text-center text-sm text-muted">
        {GUIDE_DISCLAIMER}
      </footer>
    </>
  );
}

import { vi } from 'vitest';

// next/server's after() needs a live request. Tests run the work immediately
// and collect it, so they can await delivery.
const pending: Array<Promise<unknown>> = [];

vi.mock('@/lib/runtime', () => ({
  afterResponse: (work: () => Promise<unknown>) => {
    pending.push(work());
  },
}));

(globalThis as { flushAfter?: () => Promise<void> }).flushAfter = async () => {
  await Promise.all(pending.splice(0));
};

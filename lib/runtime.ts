import { after } from 'next/server';

/**
 * Keep work alive past the response. Vercel freezes the function once it has
 * responded, so a bare promise would be cut off mid-send.
 */
export function afterResponse(work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch (error) {
      console.error('[after]', (error as Error).name);
    }
  });
}

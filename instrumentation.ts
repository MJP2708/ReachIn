/** Fail at server start, not on the first fall alert. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/lib/env');
    env();
  }
}

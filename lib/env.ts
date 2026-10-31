import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),
    LINE_ENABLED: flag,
    LINE_CHANNEL_SECRET: z.string().default(''),
    LINE_CHANNEL_ACCESS_TOKEN: z.string().default(''),
    LINE_LOGIN_CHANNEL_ID: z.string().default(''),
    NEXT_PUBLIC_LIFF_ID: z.string().default(''),
    APP_BASE_URL: z.url(),
    CRON_SECRET: z.string().min(1),
    DEMO_SECRET: z.string().default(''),
    DEVICE_SECRET_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, {
        message: 'must be 32 bytes, base64 encoded',
      }),
    ARRIVAL_RADIUS_M: z.coerce.number().positive().default(100),
    ARRIVAL_TIMEOUT_MIN: z.coerce.number().positive().default(10),
    NO_ACCEPT_ESCALATE_MIN: z.coerce.number().positive().default(3),
    HEARTBEAT_TIMEOUT_MIN: z.coerce.number().positive().default(15),
  })
  .superRefine((value, ctx) => {
    if (!value.LINE_ENABLED) return;
    for (const key of [
      'LINE_CHANNEL_SECRET',
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_LOGIN_CHANNEL_ID',
      'NEXT_PUBLIC_LIFF_ID',
    ] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'required when LINE_ENABLED=true',
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Tests change process.env and need it read again. */
export function resetEnvForTests() {
  cached = undefined;
}

/**
 * Validated environment.
 *
 * Parsed on first use rather than at import, because `next build` imports
 * every route to collect its metadata and has no runtime secrets.
 * instrumentation.ts calls this at server start so a bad deploy fails at once
 * instead of on the first fall alert.
 */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // Names only: the values are secrets.
      const names = parsed.error.issues.map((issue) => issue.path.join('.'));
      throw new Error(`Invalid environment: ${names.join(', ')}`);
    }
    cached = parsed.data;
  }
  return cached;
}

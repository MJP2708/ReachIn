import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { HttpError } from '@/lib/http-error';

type Params = Record<string, string>;
type Context<P extends Params> = { params: Promise<P> };

/** Turn thrown HttpErrors into their status; anything else is a Thai 500. */
export function route<P extends Params = Params>(
  handler: (req: NextRequest, params: P) => Promise<NextResponse>,
) {
  return async (req: NextRequest, context: Context<P>) => {
    try {
      return await handler(req, await context.params);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      // The name only: Prisma messages quote the values they failed on.
      console.error('[api]', req.nextUrl.pathname, (error as Error).name);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในระบบ' },
        { status: 500 },
      );
    }
  };
}

export async function readBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  const json: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
  return parsed.data;
}

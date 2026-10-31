export type ApiResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

/** POST JSON and return a Thai error instead of throwing. */
export async function postJson<T = object>(
  url: string,
  body: unknown = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.ok) return { ...data, ok: true };
    return {
      ok: false,
      status: res.status,
      error: data.error ?? 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่',
    };
  }
}

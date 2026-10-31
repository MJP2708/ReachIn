/**
 * Link to a page inside the LIFF app.
 *
 * With a LIFF ID the link opens in LINE, and LINE appends the path to the
 * Endpoint URL, which must therefore be the bare app domain. Without one
 * (LINE_ENABLED=false) it is an ordinary link for the demo.
 */
export function liffUrl(path: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) return `https://liff.line.me/${liffId}${path}`;
  return `${process.env.APP_BASE_URL ?? ''}${path}`;
}

export const EMS_NUMBER = '1669';
export const EMS_URI = `tel:${EMS_NUMBER}`;

/** Walking directions, shown only to the accepter. */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

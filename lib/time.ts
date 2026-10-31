const TIME_ZONE = 'Asia/Bangkok';

/** 24-hour Bangkok time, as "03:12". */
export function clock(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Short Thai date, as "31 ต.ค.". */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function monthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(date);
  return parts.slice(0, 7);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

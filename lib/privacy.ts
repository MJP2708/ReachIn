import type { CircleRole } from '@/lib/generated/prisma/client';

/**
 * Who may see medical and key-holder details: FAMILY and INNER always, and
 * whoever has accepted an open incident. A BACKUP helper sees nothing until
 * they accept, and loses it again when the incident closes.
 */
export function canSeePrivate(input: {
  role: CircleRole;
  isOpenIncidentAccepter: boolean;
}): boolean {
  return (
    input.role === 'FAMILY' ||
    input.role === 'INNER' ||
    input.isOpenIncidentAccepter
  );
}

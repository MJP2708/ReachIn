export type Availability = {
  availability: boolean;
  availabilityUntil: Date | null;
};

/** The toggle alone is not enough: "until 07:00" must lapse on its own. */
export function isAvailable(user: Availability, now = new Date()): boolean {
  if (!user.availability) return false;
  return !user.availabilityUntil || user.availabilityUntil > now;
}

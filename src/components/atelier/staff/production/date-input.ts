/** A `<input type="date">` names a day in the staff member's zone; these keep the two shapes honest. */
export function timestampToDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midday local, so the day reads the same in any nearby zone. Null for an empty or malformed value. */
export function dateInputToTimestamp(value: string): number | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const at = new Date(year, month - 1, day, 12, 0, 0).getTime();
  return Number.isFinite(at) ? at : null;
}

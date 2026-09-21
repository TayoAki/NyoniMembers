/** Every number a member reads goes through here, so money and dates look the same everywhere. */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function money(amount: number): string {
  return Number.isInteger(amount) ? usd.format(amount) : usdCents.format(amount);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function shortDate(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function longDate(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function weekday(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

/** "in 3 days", "yesterday", "2 weeks ago" — relative time a member can read at a glance. */
export function relativeDate(value: number | Date, now = Date.now()): string {
  const date = value instanceof Date ? value.getTime() : value;
  const days = Math.round((date - now) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (Math.abs(days) < 7) return days > 0 ? `in ${pluralize(days, "day")}` : `${pluralize(-days, "day")} ago`;
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 5) return weeks > 0 ? `in ${pluralize(weeks, "week")}` : `${pluralize(-weeks, "week")} ago`;
  return longDate(date);
}

/** Cost per wear is the wardrobe's honesty metric: unworn pieces have none, not a division by zero. */
export function costPerWear(costUsd: number | undefined, wearCount: number): string {
  if (costUsd === undefined) return "—";
  if (wearCount <= 0) return "not worn yet";
  return `${money(costUsd / wearCount)} a wear`;
}

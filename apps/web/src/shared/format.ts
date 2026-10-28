/**
 * Date as the workshop reads it, such as "28 oct 2026".
 */
const DATE: Intl.DateTimeFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

/**
 * Date and time, such as "28 oct 2026, 10:35 a. m.".
 */
const DATE_TIME: Intl.DateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Formats a date.
 *
 * @param value - ISO date or date-time.
 * @returns The formatted date.
 */
export function formatDate(value: string): string {
  const date: Date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return DATE.format(date);
}

/**
 * Formats a date with its time.
 *
 * @param value - ISO date-time.
 * @returns The formatted date and time.
 */
export function formatDateTime(value: string): string {
  return DATE_TIME.format(new Date(value));
}

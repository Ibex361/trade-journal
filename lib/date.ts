// Formats a Date as a local-calendar YYYY-MM-DD string.
//
// Date.toISOString() converts to UTC first, which silently rolls the date
// back by one for anyone in a timezone ahead of UTC during the hours right
// after local midnight (e.g. 1am in UTC+3 is still "yesterday" in UTC).
// Every place in the app that needs "today" (or an offset from it) as a
// plain calendar date should go through this instead, so it always reflects
// the browser's local calendar day rather than the UTC one.
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

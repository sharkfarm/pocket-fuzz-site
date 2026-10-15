export const MOUNTAIN_TIME_ZONE = "America/Denver";
export function mountainDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOUNTAIN_TIME_ZONE, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return get("year") + "-" + get("month") + "-" + get("day") + "T" + get("hour") + ":" + get("minute");
}
// Reject skipped or repeated daylight saving wall times rather than guessing.
export function parseMountainCutoff(value: FormDataEntryValue | null): string | null {
  const input = String(value ?? "").trim();
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) {
    throw new Error("Enter a valid ticket cutoff in Mountain Time.");
  }
  const candidates = ["-06:00", "-07:00"]
    .map((offset) => new Date(input + ":00" + offset))
    .filter((date) => Number.isFinite(date.getTime()) && mountainDateTimeInput(date.toISOString()) === input);
  if (candidates.length !== 1) {
    throw new Error("This Mountain Time is invalid or repeats during a daylight saving change. Choose a different time.");
  }
  return candidates[0].toISOString();
}
export function ticketSalesClosed(cutoff: string | null | undefined, now = Date.now()): boolean {
  return Boolean(cutoff && (!Number.isFinite(Date.parse(cutoff)) || now >= Date.parse(cutoff)));
}

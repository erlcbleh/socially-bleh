const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });

export function relativeTime(value: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsed = date.getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) return formatter.format(Math.round(elapsed / ms), unit);
  }
  return "now";
}

export function absoluteTime(value: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Convert a naive local datetime string ("YYYY-MM-DDTHH:mm") to an ISO string
 * with the browser's local timezone offset (e.g. "2026-03-03T10:00:00-05:00").
 *
 * This ensures the backend stores the correct UTC moment while preserving the
 * local hour for operating-hours validation.
 */
export function toLocalISOString(naive: string): string {
  const d = new Date(naive)
  const offset = -d.getTimezoneOffset() // minutes east of UTC
  const sign = offset >= 0 ? '+' : '-'
  const oh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const om = String(Math.abs(offset) % 60).padStart(2, '0')
  // naive is "YYYY-MM-DDTHH:mm", append ":00" for seconds
  return `${naive}:00${sign}${oh}:${om}`
}

/**
 * Convert a UTC/ISO datetime string from the API (e.g. "2026-03-05T13:00:00+00:00")
 * to a naive local datetime string ("YYYY-MM-DDTHH:mm") for use in form inputs.
 */
export function utcToLocalNaive(utcStr: string): string {
  const d = new Date(utcStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

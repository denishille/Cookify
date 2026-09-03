/** ISO-8601-Kalenderwoche als "YYYY-Www" (z. B. "2026-W36"). */
export function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Montag der ISO-Woche als Date (lokale Zeit). */
export function weekStart(week: string): Date {
  const [y, w] = week.split('-W').map(Number)
  const jan4 = new Date(y, 0, 4)
  const day = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - day + 1 + (w - 1) * 7)
  return monday
}

/** Verschiebt eine ISO-Woche um n Wochen. */
export function addWeeks(week: string, n: number): string {
  const d = weekStart(week)
  d.setDate(d.getDate() + n * 7 + 3) // Donnerstag der Zielwoche, damit isoWeek stabil ist
  return isoWeek(d)
}

/** Lexikografischer Vergleich reicht, weil das Format Nullen auffüllt. */
export function weekLte(a: string, b: string): boolean {
  return a <= b
}

export function formatWeek(week: string): string {
  const start = weekStart(week)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return `KW ${Number(week.split('-W')[1])} · ${f(start)} – ${f(end)}`
}

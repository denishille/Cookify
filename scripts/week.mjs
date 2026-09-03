// ISO-Wochen-Helfer für Node-Skripte (Spiegel von src/lib/week.ts).
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function weekStart(week) {
  const [y, w] = week.split('-W').map(Number)
  const jan4 = new Date(y, 0, 4)
  const day = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - day + 1 + (w - 1) * 7)
  return monday
}

export function addWeeks(week, n) {
  const d = weekStart(week)
  d.setDate(d.getDate() + n * 7 + 3)
  return isoWeek(d)
}

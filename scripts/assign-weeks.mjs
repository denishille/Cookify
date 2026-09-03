#!/usr/bin/env node
// Ordnet jedem Rezept eine ISO-Woche zu, ab der es in der App sichtbar ist (src/data/schedule.json).
// Bereits zugeordnete Rezepte bleiben unverändert (idempotent).
//
//   node scripts/assign-weeks.mjs                 # Standard: Start-Bestand sofort, Pipeline ab nächster Woche
//   node scripts/assign-weeks.mjs --per-week 4    # Anzahl Rezepte pro Woche für die Pipeline
//
// Start-Bestand = alle Dateien außer der Pipeline-Datei (part5.json) und weekly-*.json.
// Pipeline      = part5.json, wird ab nächster Woche in Häppchen freigeschaltet.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isoWeek, addWeeks } from './week.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src/data/recipes')
const schedulePath = join(root, 'src/data/schedule.json')

const args = process.argv.slice(2)
const perWeek = Number(args[args.indexOf('--per-week') + 1]) || 4
const LAUNCH_WEEK = '2026-W01'
const now = isoWeek(new Date())

const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'))
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()

const launch = []
const pipeline = []
for (const f of files) {
  const recipes = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const isPipeline = basename(f) === 'part5.json'
  for (const r of recipes) {
    if (r.addedWeek || schedule[r.id]) continue // weekly-*.json bringt addedWeek selbst mit
    ;(isPipeline ? pipeline : launch).push(r.id)
  }
}

// Start-Bestand: alles ab Launch verfügbar, die letzten 8 als "Neu diese Woche", 8 davor als letzte Woche.
const showcase = launch.splice(-16)
for (const id of launch) schedule[id] = LAUNCH_WEEK
showcase.slice(0, 8).forEach((id) => (schedule[id] = addWeeks(now, -1)))
showcase.slice(8).forEach((id) => (schedule[id] = now))

// Pipeline: ab nächster Woche `perWeek` Rezepte pro Woche, hinter bereits geplanten Wochen einreihen.
const planned = Object.values(schedule).filter((w) => w > now).sort()
let week = planned.length ? planned[planned.length - 1] : now
let countInWeek = planned.filter((w) => w === week).length
if (!planned.length) { week = addWeeks(now, 1); countInWeek = 0 }
for (const id of pipeline) {
  if (countInWeek >= perWeek) { week = addWeeks(week, 1); countInWeek = 0 }
  schedule[id] = week
  countInWeek++
}

writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n')
const byWeek = {}
for (const w of Object.values(schedule)) byWeek[w] = (byWeek[w] ?? 0) + 1
console.log(`Aktuelle Woche: ${now}`)
for (const w of Object.keys(byWeek).sort()) console.log(`  ${w}: ${byWeek[w]} Rezepte${w === now ? '  ← jetzt' : w > now ? '  (geplant)' : ''}`)

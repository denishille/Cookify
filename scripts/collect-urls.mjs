#!/usr/bin/env node
// Sammelt Rezept-Links von Übersichtsseiten und schreibt sie in eine Warteschlange.
// Aufruf: node scripts/collect-urls.mjs --out scripts/queue/x.txt <übersichtsseite> …
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const UA = 'CookifyBot/1.0 (+https://github.com/denishille/Cookify; liest nur schema.org-Rezeptmetadaten)'
const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const out = outIdx >= 0 ? args[outIdx + 1] : null
const pages = args.filter((a) => a.startsWith('http'))

/** Was auf den erlaubten Seiten wie ein Rezept-Link aussieht. */
const PATTERNS = [
  /https:\/\/www\.hellofresh\.de\/recipes\/[a-z0-9-]+-[0-9a-f]{24}/gi,
  /https:\/\/mobile\.kptncook\.com\/recipe\/pinterest\/[^"'\s<>]+\/[0-9a-f]{6,10}/gi,
  /"\/recipes\/([a-z0-9-]+-[0-9a-f]{24})"/gi,
]

const found = new Set()
for (const page of pages) {
  try {
    const res = await fetch(page, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
    if (!res.ok) { console.log(`– ${page}: HTTP ${res.status}`); continue }
    const html = await res.text()
    let n = 0
    for (const re of PATTERNS) {
      for (const m of html.matchAll(re)) {
        const url = m[1] ? `https://www.hellofresh.de/recipes/${m[1]}` : m[0]
        if (!found.has(url)) { found.add(url); n++ }
      }
    }
    console.log(`✓ ${page}: ${n} neue Links (${html.length} Zeichen)`)
  } catch (e) { console.log(`✗ ${page}: ${e.message}`) }
  await new Promise((r) => setTimeout(r, 800))
}

const list = [...found]
console.log(`\n${list.length} Rezept-Links gefunden.`)
if (out) {
  mkdirSync(dirname(out), { recursive: true })
  const before = existsSync(out) ? readFileSync(out, 'utf8').split(/\r?\n/).filter(Boolean) : []
  const merged = [...new Set([...before, ...list])]
  writeFileSync(out, merged.join('\n') + '\n')
  console.log(`${merged.length} Zeilen in ${out}`)
} else {
  console.log(list.slice(0, 40).join('\n'))
}

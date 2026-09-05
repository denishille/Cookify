#!/usr/bin/env node
// Diagnose: schaut nach, wie eine Quellseite ihre Rezeptdaten ausliefert.
// Aufruf: node scripts/probe-url.mjs <url> [<url> …]
const UA = 'CookifyBot/1.0 (+https://github.com/denishille/Cookify; liest nur schema.org-Rezeptmetadaten)'

for (const url of process.argv.slice(2)) {
  console.log('\n=== ' + url)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, redirect: 'follow' })
    const body = await res.text()
    console.log('HTTP', res.status, res.headers.get('content-type'), body.length, 'Zeichen')
    const ld = [...body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim())
    console.log('JSON-LD-Blöcke:', ld.length)
    for (const b of ld) console.log('  ', b.slice(0, 300).replace(/\s+/g, ' '))
    for (const re of [/__NEXT_DATA__/, /__NUXT__/, /window\.__INITIAL/, /id="root"/, /id="app"/]) if (re.test(body)) console.log('gefunden:', re.source)
    const srcs = [...body.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1])
    console.log('Skripte:', srcs.slice(0, 10).join(' '))
    const apis = [...new Set([...body.matchAll(/https?:\/\/[a-z0-9.-]*kptncook[^"'\s<>]*/gi)].map((m) => m[0]))]
    console.log('kptncook-URLs im HTML:', apis.slice(0, 15).join(' '))
    console.log('Anfang:', body.slice(0, 400).replace(/\s+/g, ' '))
  } catch (e) { console.log('Fehler:', e.message) }
}

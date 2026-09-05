// Liest ein Rezept von einer KptnCook-Seite.
// KptnCook liefert keine schema.org-Daten, sondern Microdata plus eigenes Markup:
// Titel, Zeit, Portionen, Zutaten und Bild stehen vollständig auf der Seite,
// von der Zubereitung zeigt die öffentliche Seite nur die ersten Schritte.
// Das Ergebnis ist deshalb als `partialSteps` markiert.

/** ISO-8601-Dauer (PT1H30M) → Minuten */
function minutes(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso ?? '')
  if (!m) return undefined
  const v = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)
  return v || undefined
}

export function parseKptnCook(html, url, site) {
  const clean = (v) => v.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const prop = (name) => {
    const m = new RegExp(`<span[^>]+itemprop=["']${name}["'][^>]*>([\\s\\S]*?)</span>`, 'i').exec(html)
    return m ? clean(m[1]) : undefined
  }
  const title = prop('name')
  if (!title) return null
  const ingredients = [...html.matchAll(/<span[^>]+itemprop=["']ingredients["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((m) => clean(m[1])).filter(Boolean)
  const steps = [...html.matchAll(/<div class="row kptn-step-title">([\s\S]*?)<\/div>/gi)]
    .map((m) => clean(m[1]).replace(/^\d+\.\s*/, ''))
    .filter((t) => t && !/^alles parat/i.test(t))
  const image = (/<img[^>]+itemprop=["']image["'][^>]+src=["']([^"']+)["']/i.exec(html) ?? [])[1]
  const yieldText = prop('recipeYield') ?? ''
  const icons = [...html.matchAll(/recipeicons_new\/([A-Za-z]+)\.svg/g)].map((m) => m[1].toLowerCase())
  return {
    title,
    description: '',
    ingredients,
    steps,
    timeMinutes: minutes(prop('totalTime')),
    servings: Number((/\d+/.exec(yieldText) ?? [])[0]) || undefined,
    keywords: icons.join(', ') || undefined,
    image,
    partialSteps: true,
    source: { site, url, title },
    importedAt: new Date().toISOString().slice(0, 10),
  }
}


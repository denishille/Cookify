import ingredientsJson from '../data/ingredients.json'
import type { Ingredient, IngredientDef } from '../types'

/** Nur die Namen aus der Zutatenliste der App – direkt aus der Datei, ohne den großen Datenbau. */
const VOKABEL = new Map<string, string>(
  Object.values(ingredientsJson as Record<string, IngredientDef[]>).flat().map((d) => [d.key, d.name]),
)

/**
 * Welche Zutaten kommen in einem Arbeitsschritt vor?
 *
 * Die Schritttexte stammen von den Originalseiten und nennen Zutaten fast immer beim Namen,
 * aber ohne Menge („Schäle die Zwiebeln“). Hier wird jeder Schritt mit der Zutatenliste
 * abgeglichen, damit beim Kochen die Menge direkt am Schritt steht.
 *
 * Verglichen wird auf Wortstämmen, weil Deutsch beugt und zusammensetzt: „Zwiebeln“,
 * „Zwiebelwürfel“ und „Zwiebel“ sollen dieselbe Zutat treffen. Gesucht wird mit mehreren
 * Bezeichnungen je Zutat – dem Namen im Rezept, dem Namen aus der Zutatenliste der App und
 * dem Schlüssel –, denn im Rezept steht „Haselnusskerne“, im Schritt aber „Haselnüsse“.
 */

/** Zutat → Gruppe der App-Zutatenliste, für Sammelwörter wie „Gemüse“. */
const GRUPPE = new Map<string, string>(
  Object.entries(ingredientsJson as Record<string, IngredientDef[]>)
    .flatMap(([gruppe, defs]) => defs.map((d) => [d.key, gruppe] as [string, string])),
)

/** Sammelwörter im Schritt und die Gruppe, die sie meinen. */
const SAMMELWORT: Record<string, string> = { gemus: 'gemuese' }

/** Kleinbuchstaben, Umlaute aufgelöst, alles Nicht-Buchstabige zu Leerzeichen. */
function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    // Zerlegen und die Zeichen darüber wegwerfen: aus „fraîche“ wird „fraiche“, aus „Öl“ „ol“.
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

/** Schlüssel sind Umschriften („haselnuesse“) – zurück auf dieselbe Form wie die Wörter. */
function fromKey(key: string): string {
  return normal(key.replace(/ue/g, 'u').replace(/oe/g, 'o').replace(/ae/g, 'a'))
}

/** Grobe deutsche Endungen abschneiden, damit Ein- und Mehrzahl zusammenfallen. */
function stamm(wort: string): string {
  // Kein einzelnes „s“: „Reis“ und „Lachs“ wären sonst „rei“ und „lach“.
  for (const endung of ['en', 'er', 'es', 'n', 'e']) {
    if (wort.length > endung.length + 2 && wort.endsWith(endung)) return wort.slice(0, -endung.length)
  }
  return wort
}

/** Ein Suchbegriff je Schreibweise: der ganze Name, sein Hauptwort, der Schlüssel. */
function begriffe(ing: Ingredient): string[] {
  const roh = ing.name.split(',')[0]
  const worte = normal(roh).split(' ').filter(Boolean)
  const ausListe = VOKABEL.get(ing.key) ?? ''
  const listenworte = normal(ausListe).split(' ').filter(Boolean)
  const kandidaten = [
    worte.join(''),                       // „Kokos-Chips“ → „kokoschips“
    worte[worte.length - 1] ?? '',        // Hauptwort, ohne „frische“, „rote“ …
    listenworte.join(''),
    listenworte[listenworte.length - 1] ?? '',
    fromKey(ing.key).split(' ').join(''),
  ]
  return [...new Set(kandidaten.map(stamm).filter((b) => b.length >= 3))]
}

/**
 * Zutaten, die in diesem Schritt vorkommen – in der Reihenfolge der Zutatenliste.
 *
 * Trifft ein Wort auf mehrere Zutaten, gewinnt die längste Übereinstimmung: „Butterbohnen“
 * gehören zu den Butterbohnen und nicht zur Butter.
 */
export function stepIngredients(step: string, ingredients: Ingredient[]): Ingredient[] {
  const gefunden = new Set<Ingredient>()
  const gesucht = ingredients.map((ing) => ({ ing, begriffe: begriffe(ing) }))

  for (const roh of step.split(/[^A-Za-zÄÖÜäöüß]+/)) {
    if (roh.length < 3) continue
    const wortstamm = stamm(normal(roh))
    // Nur Hauptwörter dürfen lose treffen. „Hack“ meint das Hackfleisch, „backen“ nie das
    // Backpulver – und im Deutschen steht der Unterschied im großen Anfangsbuchstaben.
    const hauptwort = roh[0] === roh[0].toUpperCase()
    // „Gemüse klein schneiden“ meint alles Gemüse des Rezepts.
    const gruppe = SAMMELWORT[wortstamm]
    if (gruppe) {
      for (const { ing } of gesucht) if (GRUPPE.get(ing.key) === gruppe) gefunden.add(ing)
      continue
    }
    let beste: { ing: Ingredient; wert: number } | null = null
    for (const { ing, begriffe: bs } of gesucht) {
      for (const b of bs) {
        // Genau getroffen schlägt Wortanfang, Wortanfang schlägt Wortteil: „Kartoffeln“ meint die
        // Kartoffeln und nicht die Süßkartoffel; „Teig“ dagegen darf den Pizzateig treffen.
        const wert = b === wortstamm ? 2000 + b.length
          : b.length >= 4 && wortstamm.startsWith(b) ? 1000 + b.length
          : hauptwort && wortstamm.length >= 4 && (b.endsWith(wortstamm) || b.startsWith(wortstamm)) ? b.length
          : 0
        if (wert && (!beste || wert > beste.wert)) beste = { ing, wert }
      }
    }
    if (beste) gefunden.add(beste.ing)
  }
  return ingredients.filter((i) => gefunden.has(i))
}

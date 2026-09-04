import type { Diet, Ingredient, Recipe } from '../types'

/**
 * Regelwerk für die anpassbaren Ernährungsformen.
 *
 * Grundgedanke: Eine Zutat ist nicht pauschal „verboten“, sondern
 *  1. gar kein Problem,
 *  2. erst ab einer bestimmten Menge je Portion ein Problem (`limit`),
 *  3. immer ein Problem – dann gibt es entweder einen Ersatz oder sie kann entfallen.
 *
 * Diese Datei ist die einzige Wahrheit: Sowohl die berechneten Flags (nutrition.ts)
 * als auch die Anpassung (adapt.ts) lesen von hier, damit beides nie auseinanderläuft.
 */

/** Ersatz für eine Zutat. */
export interface Sub {
  /** Womit ersetzt wird, so wie es in der Zutatenliste stehen soll */
  by: string
  /** Zusatzhinweis, z. B. abweichende Menge */
  note?: string
  /** Nur ersetzen, wenn das Gericht nicht nach dieser Zutat benannt ist */
  minorOnly?: boolean
}

export interface DietRule {
  /** Zutat → true (immer kritisch) oder Grenzmenge in g/ml je Portion, bis zu der sie unkritisch ist */
  limits: Record<string, true | number>
  subs: Record<string, Sub>
  /** Zutaten, die ersatzlos entfallen können, solange sie nicht prägend sind */
  omit: Set<string>
  /** Wie viele Zutaten höchstens wegfallen dürfen */
  maxOmit: number
  /** Mehr Änderungen als das ergeben kein angepasstes Rezept mehr, sondern ein anderes Gericht */
  maxChanges: number
  /** Zusätzliche Bedingung an das ganze Rezept */
  extra?: (r: Recipe) => string | null
}

/** Ungefähres Gewicht einer Einheit in Gramm, für die Mengenprüfung. */
const UNIT_GRAMS: Record<string, number> = {
  g: 1, ml: 1, el: 15, tl: 5, prise: 0.5, zehe: 4, scheibe: 15, bund: 25, handvoll: 25,
}

/** Übliches Gewicht eines Stücks in Gramm, für Zutaten, die in Stück gezählt werden. */
const PIECE_GRAMS: Record<string, number> = {
  apfel: 150, birne: 160, banane: 120, orange: 130, zitrone: 70, limette: 45, pfirsich: 120, kiwi: 75,
  mango: 300, granatapfel: 250, zwiebel: 80, knoblauch: 4, karotte: 70, kartoffel: 100, suesskartoffel: 200,
  tomate: 100, cherrytomate: 12, paprika: 150, zucchini: 200, aubergine: 250, gurke: 300, fenchel: 250,
  lauch: 200, fruehlingszwiebel: 15, chili: 5, avocado: 150, kohlrabi: 200, 'rote-bete': 120, pastinake: 120,
  eier: 55, haehnchenbrust: 150, haehnchenschenkel: 150, schweineschnitzel: 150, rindersteak: 200,
  bratwurst: 100, wuerstchen: 70, broetchen: 60, toast: 25, tortillas: 40, pita: 60, naan: 90,
  blaetterteig: 275, pizzateig: 250, artischocken: 120, spargel: 20, mais: 90, salat: 250, chinakohl: 600,
  blumenkohl: 700, brokkoli: 400, weisskohl: 900, rotkohl: 900, sellerie: 400, kuerbis: 900, ingwer: 30,
}

/** Übliches Gewicht einer Packung in Gramm – bei Vanillezucker sind es 8 g, bei Blätterteig 275 g. */
const PACKAGE_GRAMS: Record<string, number> = {
  vanillezucker: 8, backpulver: 16, natron: 15, hefe: 7, gelatine: 10, speisestaerke: 250,
  blaetterteig: 275, pizzateig: 250, 'mehlbutter-fertigteig': 275, loeffelbiskuits: 200, butterkekse: 200,
  mozzarella: 125, feta: 200, frischkaese: 200, halloumi: 225, schokolade: 100, zartbitterschokolade: 100,
  'weisse-schokolade': 100, sahne: 200, schmand: 200, 'creme-fraiche': 200, quark: 250, joghurt: 500,
  tortillas: 320, gnocchi: 500, spaghetti: 500, penne: 500, nudeln: 500, reis: 500, tofu: 200, raeuchertofu: 200,
  passata: 500, kokosmilch: 400, mandeln: 200, walnuesse: 200, haselnuesse: 200, rosinen: 200, granola: 500,
}

/** Übliches Füllgewicht einer Dose in Gramm. */
const CAN_GRAMS: Record<string, number> = {
  'tomaten-dose': 400, kidneybohnen: 400, 'schwarze-bohnen': 400, 'weisse-bohnen': 400, kichererbsen: 400,
  mais: 300, 'thunfisch-dose': 150, sardellen: 50, kokosmilch: 400, passata: 500, tomatenmark: 70,
  pfirsich: 480, ananas: 340, muscheln: 400, artischocken: 240, oliven: 200,
}

/** Menge einer Zutat je Portion in Gramm; null, wenn sie sich nicht sinnvoll umrechnen lässt. */
export function portionGrams(ing: Ingredient, servings: number): number | null {
  if (ing.amount === null || servings <= 0) return null
  const unit = ing.unit.trim().toLowerCase()
  let factor: number | undefined
  if (unit === 'stück' || unit === 'stueck' || unit === '') factor = PIECE_GRAMS[ing.key] ?? 100
  else if (unit === 'packung') factor = PACKAGE_GRAMS[ing.key] ?? 150
  else if (unit === 'dose') factor = CAN_GRAMS[ing.key] ?? 400
  else factor = UNIT_GRAMS[unit]
  if (factor === undefined) return null
  return (ing.amount * factor) / servings
}

/** Verstößt die Zutat in dieser Menge gegen die Regel? */
export function violates(ing: Ingredient, servings: number, rule: DietRule): boolean {
  const limit = rule.limits[ing.key]
  if (limit === undefined) return false
  if (limit === true) return true
  const grams = portionGrams(ing, servings)
  // Ohne umrechenbare Menge lieber vorsichtig sein und die Zutat als kritisch behandeln.
  return grams === null || grams > limit
}

const sub = (by: string, note?: string, minorOnly = false): Sub => ({ by, note, minorOnly })

// ---------------------------------------------------------------- Gluten

const GLUTEN_LIMITS: Record<string, true | number> = Object.fromEntries([
  'spaghetti', 'penne', 'nudeln', 'lasagneplatten', 'gnocchi', 'udon', 'ramen-nudeln', 'mehl', 'vollkornmehl',
  'semmelbroesel', 'brot', 'toast', 'baguette', 'broetchen', 'tortillas', 'pizzateig', 'blaetterteig',
  'mehlbutter-fertigteig', 'pita', 'naan', 'couscous', 'bulgur', 'haferflocken', 'granola', 'knaeckebrot',
  'sojasauce', 'worcestersauce', 'miso', 'bier', 'seitan', 'loeffelbiskuits', 'butterkekse',
].map((k) => [k, true as const]))

const GLUTEN_SUBS: Record<string, Sub> = {
  spaghetti: sub('glutenfreie Spaghetti'), penne: sub('glutenfreie Penne'), nudeln: sub('glutenfreie Nudeln'),
  lasagneplatten: sub('glutenfreie Lasagneplatten'), gnocchi: sub('glutenfreie Gnocchi'),
  udon: sub('Reisnudeln', undefined, true), 'ramen-nudeln': sub('Reisnudeln', undefined, true),
  mehl: sub('glutenfreie Mehlmischung', 'mit 1 TL Flohsamenschalen je 200 g, sonst bindet der Teig schlecht'),
  vollkornmehl: sub('glutenfreie Vollkornmehlmischung', 'mit 1 TL Flohsamenschalen je 200 g'),
  semmelbroesel: sub('glutenfreie Semmelbrösel oder gemahlene Maisflakes'),
  brot: sub('glutenfreies Brot'), toast: sub('glutenfreies Toastbrot'), baguette: sub('glutenfreies Baguette'),
  broetchen: sub('glutenfreie Brötchen'), tortillas: sub('Maistortillas'), pita: sub('glutenfreies Fladenbrot'),
  naan: sub('glutenfreies Fladenbrot'), pizzateig: sub('glutenfreier Pizzateig'),
  blaetterteig: sub('glutenfreier Blätterteig'), 'mehlbutter-fertigteig': sub('glutenfreier Mürbeteig'),
  couscous: sub('Quinoa', undefined, true), bulgur: sub('Quinoa', undefined, true),
  haferflocken: sub('glutenfreie Haferflocken', 'Hafer ist von Natur aus glutenfrei, wird aber oft mit Weizen verunreinigt'),
  granola: sub('glutenfreies Granola'), knaeckebrot: sub('glutenfreies Knäckebrot'),
  sojasauce: sub('Tamari', 'die glutenfreie Variante der Sojasauce'),
  worcestersauce: sub('glutenfreie Worcestersauce'), miso: sub('helles Reis-Miso', 'Gerstenmiso enthält Gluten'),
  bier: sub('glutenfreies Bier'), seitan: sub('fester Tofu', 'Seitan besteht aus Weizeneiweiß', true),
  loeffelbiskuits: sub('glutenfreie Löffelbiskuits'), butterkekse: sub('glutenfreie Butterkekse'),
}

// ---------------------------------------------------------------- Laktose
// Lang gereifter Hartkäse (Parmesan, Gouda, Emmentaler, Cheddar, Blauschimmel) ist praktisch
// laktosefrei und steht deshalb bewusst nicht in der Liste. Butter enthält nur Spuren.

const LACTOSE_LIMITS: Record<string, true | number> = {
  milch: true, sahne: true, schmand: true, 'creme-fraiche': true, joghurt: true, 'griechischer-joghurt': true,
  quark: true, skyr: true, huettenkaese: true, frischkaese: true, mozzarella: true, feta: true, ricotta: true,
  mascarpone: true, halloumi: true, ziegenkaese: true, 'kaese-gerieben': true, buttermilch: true,
  'eis-vanille': true, milchreis: true,
  butter: 30, // bis etwa 30 g je Portion unkritisch, Butter enthält kaum Laktose
}

const LACTOSE_SUBS: Record<string, Sub> = {
  milch: sub('laktosefreie Milch oder Hafermilch'), sahne: sub('Hafercreme zum Kochen'),
  schmand: sub('laktosefreier Schmand'), 'creme-fraiche': sub('laktosefreie Crème fraîche'),
  joghurt: sub('laktosefreier Joghurt'), 'griechischer-joghurt': sub('laktosefreier griechischer Joghurt'),
  quark: sub('laktosefreier Quark'), skyr: sub('laktosefreier Skyr'), huettenkaese: sub('laktosefreier Hüttenkäse'),
  frischkaese: sub('laktosefreier Frischkäse'), mozzarella: sub('laktosefreier Mozzarella'),
  feta: sub('laktosefreier Feta'), ricotta: sub('laktosefreier Ricotta'), mascarpone: sub('laktosefreier Mascarpone'),
  halloumi: sub('laktosefreier Grillkäse'), ziegenkaese: sub('gereifter Ziegenkäse', 'je länger gereift, desto weniger Laktose'),
  'kaese-gerieben': sub('geriebener Hartkäse', 'lang gereifter Käse ist praktisch laktosefrei'),
  buttermilch: sub('laktosefreie Milch mit einem Spritzer Zitrone'), 'eis-vanille': sub('laktosefreies Vanilleeis'),
  butter: sub('laktosefreie Butter'), milchreis: sub('Milchreis mit laktosefreier Milch'),
}

// ---------------------------------------------------------------- Low FODMAP
// Grenzmengen nach der üblichen Monash-Einordnung, auf eine Portion gerechnet.

const FODMAP_LIMITS: Record<string, true | number> = {
  ...GLUTEN_LIMITS, ...LACTOSE_LIMITS,
  zwiebel: true, knoblauch: true, lauch: true, fruehlingszwiebel: true, blumenkohl: true, champignons: true,
  pilze: true, spargel: true, artischocken: true, rosenkohl: true, sellerie: true, sauerkraut: 40,
  erbsen: 15, fenchel: 48, 'rote-bete': 20, mais: 38, weisskohl: 75, brokkoli: 75, avocado: 30,
  suesskartoffel: 70, 'getrocknete-tomaten': 8,
  apfel: true, birne: true, mango: true, kirschen: true, pflaumen: true, pfirsich: true, wassermelone: true,
  datteln: true, feigen: true, rosinen: 13, granatapfel: 45, banane: 100,
  honig: true, agavendicksaft: true,
  kichererbsen: 42, 'linsen-rot': 46, 'linsen-braun': 46, belugalinsen: 46, kidneybohnen: 30,
  'schwarze-bohnen': 40, 'weisse-bohnen': 35, edamame: 90, sojahack: true, sojamilch: true,
  cashews: true, pistazien: true, mandeln: 20, haselnuesse: 30,
  hafermilch: 100, kokosmilch: 120, schokolade: 25, 'weisse-schokolade': 25, zartbitterschokolade: 30,
}

const FODMAP_SUBS: Record<string, Sub> = {
  ...GLUTEN_SUBS, ...LACTOSE_SUBS,
  zwiebel: sub('das Grün von Lauchzwiebeln', 'im Zwiebelgrün stecken keine Fruktane', true),
  fruehlingszwiebel: sub('nur das Grün der Frühlingszwiebeln', undefined, true),
  lauch: sub('nur das Lauchgrün', undefined, true),
  knoblauch: sub('Knoblauchöl', 'Fruktane sind nicht fettlöslich, das Aroma bleibt trotzdem', true),
  blumenkohl: sub('Brokkoliröschen', undefined, true), champignons: sub('Austernpilze', undefined, true), pilze: sub('Austernpilze', undefined, true),
  spargel: sub('grüne Bohnen', undefined, true), rosenkohl: sub('grüne Bohnen', undefined, true), sellerie: sub('Pastinake', undefined, true),
  fenchel: sub('Zucchini', undefined, true), erbsen: sub('grüne Bohnen', undefined, true), 'rote-bete': sub('Karotten', undefined, true), mais: sub('Karotten', undefined, true),
  weisskohl: sub('Chinakohl', undefined, true), brokkoli: sub('Brokkoliröschen', 'nur die Röschen, die Stiele sind kritisch'),
  avocado: sub('Feta oder ein paar Walnüsse', undefined, true), suesskartoffel: sub('Kartoffeln', undefined, true),
  'getrocknete-tomaten': sub('frische Cherrytomaten', undefined, true), sauerkraut: sub('milder Chinakohlsalat', undefined, true),
  apfel: sub('Orange', undefined, true), birne: sub('Orange', undefined, true), mango: sub('Ananas', undefined, true), kirschen: sub('Erdbeeren', undefined, true),
  pflaumen: sub('Erdbeeren', undefined, true), pfirsich: sub('Erdbeeren', undefined, true), wassermelone: sub('Honigmelone', undefined, true),
  banane: sub('feste, noch grünliche Banane'), granatapfel: sub('Heidelbeeren', undefined, true),
  honig: sub('Ahornsirup'), agavendicksaft: sub('Ahornsirup'),
  kichererbsen: sub('Kichererbsen aus der Dose', 'gut abspülen und höchstens eine kleine Portion'),
  'linsen-rot': sub('Dosenlinsen', 'gut abspülen, das schwemmt einen Teil der FODMAPs aus'),
  'linsen-braun': sub('Dosenlinsen', 'gut abspülen'), belugalinsen: sub('Dosenlinsen', 'gut abspülen'),
  kidneybohnen: sub('feste Tofuwürfel', undefined, true), 'schwarze-bohnen': sub('feste Tofuwürfel', undefined, true),
  'weisse-bohnen': sub('feste Tofuwürfel', undefined, true), sojahack: sub('Hackfleisch oder Tempeh', undefined, true),
  sojamilch: sub('Sojadrink aus Sojaprotein oder Mandelmilch', undefined, true), hafermilch: sub('Mandelmilch', undefined, true),
  kokosmilch: sub('Kokosmilch sparsam', 'höchstens 120 ml je Portion'),
  cashews: sub('Macadamias oder Erdnüsse', undefined, true), pistazien: sub('Walnüsse', undefined, true), mandeln: sub('Walnüsse', undefined, true),
  haselnuesse: sub('Walnüsse', undefined, true),
  schokolade: sub('Zartbitterschokolade', 'davon sind bis zu 30 g je Portion unkritisch'),
  'weisse-schokolade': sub('Zartbitterschokolade', undefined, true),
}

const FODMAP_OMIT = new Set(['artischocken', 'datteln', 'feigen', 'rosinen', 'milchreis', 'edamame'])

// ---------------------------------------------------------------- Fruktose
// Haushaltszucker ist Saccharose, also zur Hälfte Fruchtzucker – deshalb steht er hier
// und wird durch Traubenzucker (reine Glukose) oder Reissirup ersetzt.

/**
 * Fruchtzucker je 100 g: `total` ist der gesamte Fruktoseanteil (freie Fruktose plus die Hälfte
 * des Haushaltszuckers, der im Darm zu Fruktose gespalten wird), `excess` der Überschuss über
 * den Traubenzuckergehalt hinaus. Bei Fruktosemalabsorption zählt vor allem der Überschuss:
 * Traubenzucker hilft, die Fruktose aufzunehmen. Wer streng filtert, geht nach dem Gesamtwert –
 * deshalb fällt dann auch eine Orange raus, obwohl sie gut ausgeglichen ist.
 * Werte gerundet nach den üblichen Nährwerttabellen (Souci-Fachmann-Kraut, USDA).
 */
export const FRUCTOSE_G: Record<string, { total: number; excess: number }> = {
  // Obst
  apfel: { total: 5.7, excess: 3.7 }, birne: { total: 6.7, excess: 5.0 }, banane: { total: 3.4, excess: 0 },
  orange: { total: 2.6, excess: 0.2 }, zitrone: { total: 1.4, excess: 0 }, limette: { total: 0.8, excess: 0 },
  erdbeeren: { total: 2.2, excess: 0 }, himbeeren: { total: 2.1, excess: 0.3 }, heidelbeeren: { total: 3.3, excess: 0.7 },
  beeren: { total: 2.6, excess: 0.3 }, mango: { total: 2.6, excess: 1.7 }, ananas: { total: 2.4, excess: 0.3 },
  kirschen: { total: 6.3, excess: 0 }, pflaumen: { total: 2.0, excess: 0 }, pfirsich: { total: 1.2, excess: 0.2 },
  trauben: { total: 7.3, excess: 0.2 }, rhabarber: { total: 0.4, excess: 0 }, granatapfel: { total: 4.7, excess: 0.5 },
  kokos: { total: 1.0, excess: 0.4 }, datteln: { total: 24, excess: 0 }, rosinen: { total: 33, excess: 1 },
  feigen: { total: 24, excess: 0 }, wassermelone: { total: 3.9, excess: 1.9 }, kiwi: { total: 4.3, excess: 0.3 },
  avocado: { total: 0.2, excess: 0 },
  // Gemüse mit nennenswertem Anteil
  tomate: { total: 1.4, excess: 0.3 }, cherrytomate: { total: 1.6, excess: 0.4 }, paprika: { total: 2.0, excess: 0.3 },
  karotte: { total: 1.3, excess: 0.2 }, zwiebel: { total: 1.3, excess: 0.3 }, 'rote-bete': { total: 0.2, excess: 0 },
  mais: { total: 1.9, excess: 0.4 }, kuerbis: { total: 1.6, excess: 0.4 }, 'getrocknete-tomaten': { total: 9, excess: 2.5 },
  suesskartoffel: { total: 1.4, excess: 0.3 },
  // Süßungsmittel und Verarbeitetes
  zucker: { total: 50, excess: 0 }, 'brauner-zucker': { total: 49, excess: 0 }, puderzucker: { total: 50, excess: 0 },
  vanillezucker: { total: 49, excess: 0 }, honig: { total: 38, excess: 7 }, agavendicksaft: { total: 60, excess: 40 },
  ahornsirup: { total: 30, excess: 0 }, marmelade: { total: 30, excess: 6 }, apfelmus: { total: 7, excess: 3 },
  orangensaft: { total: 4.5, excess: 0.5 }, ketchup: { total: 12, excess: 3 }, 'bbq-sauce': { total: 15, excess: 4 },
  balsamico: { total: 10, excess: 2 }, sriracha: { total: 8, excess: 2 }, erdnusssauce: { total: 6, excess: 1 },
  tomatenmark: { total: 6, excess: 1.5 }, passata: { total: 2.5, excess: 0.6 }, 'tomaten-dose': { total: 1.8, excess: 0.4 },
  schokolade: { total: 25, excess: 0 }, 'weisse-schokolade': { total: 28, excess: 0 }, zartbitterschokolade: { total: 16, excess: 0 },
  'eis-vanille': { total: 11, excess: 0 }, loeffelbiskuits: { total: 30, excess: 0 }, butterkekse: { total: 12, excess: 0 },
  granola: { total: 12, excess: 1 }, mayonnaise: { total: 1.5, excess: 0 }, senf: { total: 2, excess: 0.3 },
  'erdnussbutter': { total: 3, excess: 0 }, sojasauce: { total: 1, excess: 0 }, currypaste: { total: 4, excess: 1 },
  pesto: { total: 2, excess: 0.3 }, apfelessig: { total: 0.5, excess: 0 },
}

/** Wie viel Fruchtzucker je Portion noch in Ordnung ist. */
export const FRUCTOSE_BUDGET = { normal: 2.5, streng: 0.8 }

/** Fruchtzucker einer Zutatenmenge in Gramm; `strict` rechnet mit dem Gesamtwert statt dem Überschuss. */
export function fructoseGrams(ing: Ingredient, servings: number, strict: boolean): number | null {
  const entry = FRUCTOSE_G[ing.key]
  if (!entry) return 0
  const grams = portionGrams(ing, servings)
  if (grams === null) return null
  return ((strict ? entry.total : entry.excess) * grams) / 100
}

// Diese Zutaten gelten unabhängig vom Budget: konzentrierter Zucker und Fruktane
// (Zwiebel, Knoblauch, Lauch), die kein Fruchtzucker sind, aber dieselben Beschwerden machen.
const FRUCTOSE_LIMITS: Record<string, true | number> = {
  zucker: 12, 'brauner-zucker': 12, puderzucker: 12, vanillezucker: 8,
  honig: 5, agavendicksaft: 3, ahornsirup: 8, marmelade: 15,
  datteln: true, feigen: true, rosinen: 15,
  zwiebel: true, knoblauch: true, lauch: true, artischocken: true, spargel: 60,
}

const DEXTROSE_NOTE = 'Traubenzucker süßt schwächer als Haushaltszucker, nimm etwa ein Drittel mehr'

const FRUCTOSE_SUBS: Record<string, Sub> = {
  zucker: sub('Traubenzucker (Dextrose)', DEXTROSE_NOTE),
  'brauner-zucker': sub('Traubenzucker mit einem Teelöffel Melasse', DEXTROSE_NOTE),
  puderzucker: sub('fein gemahlener Traubenzucker'),
  vanillezucker: sub('Vanillemark mit Traubenzucker'),
  honig: sub('Reissirup', 'Reissirup besteht fast nur aus Glukose'),
  agavendicksaft: sub('Reissirup', 'Agavendicksaft ist besonders fruktosereich'),
  ahornsirup: sub('Reissirup'),
  marmelade: sub('Marmelade mit Traubenzucker', 'im Reformhaus als fruktosefreier Aufstrich'),
  apfelmus: sub('Bananenmus', undefined, true), orangensaft: sub('Wasser mit einem Spritzer Zitrone', undefined, true),
  apfel: sub('reife Banane', undefined, true), birne: sub('reife Banane', undefined, true), mango: sub('Papaya', undefined, true), ananas: sub('Papaya', undefined, true),
  kiwi: sub('Mandarine', undefined, true), kirschen: sub('Erdbeeren', undefined, true), pflaumen: sub('Erdbeeren', undefined, true), pfirsich: sub('Erdbeeren', undefined, true),
  trauben: sub('Erdbeeren', undefined, true), wassermelone: sub('Erdbeeren', undefined, true), granatapfel: sub('Heidelbeeren', undefined, true),
  zwiebel: sub('das Grün von Lauchzwiebeln', undefined, true), lauch: sub('nur das Lauchgrün', undefined, true),
  knoblauch: sub('Knoblauchöl', 'Fruktane gehen nicht ins Öl über', true),
  spargel: sub('grüne Bohnen', undefined, true),
  ketchup: sub('Tomatenmark mit etwas Traubenzucker', undefined, true),
  'bbq-sauce': sub('Tomatenmark mit Paprikapulver und Traubenzucker', undefined, true),
  balsamico: sub('Weißweinessig', 'Balsamico wird aus Traubenmost gekocht', true),
  sriracha: sub('Chiliflocken', undefined, true), erdnusssauce: sub('Erdnussmus mit Sojasauce', undefined, true),
  tomatenmark: sub('Passata', 'weniger konzentriert, dafür etwas mehr davon', true),
  'getrocknete-tomaten': sub('frische Cherrytomaten', undefined, true),
  schokolade: sub('Schokolade mit Traubenzucker'), 'weisse-schokolade': sub('Schokolade mit Traubenzucker'),
  zartbitterschokolade: sub('Zartbitterschokolade mit hohem Kakaoanteil', 'je mehr Kakao, desto weniger Zucker'),
  'eis-vanille': sub('Sahne mit Vanille und Traubenzucker'),
  loeffelbiskuits: sub('Löffelbiskuits mit Traubenzucker'), butterkekse: sub('Kekse mit Traubenzucker'),
  granola: sub('Haferflocken mit Nüssen', 'Fertiggranola ist meist stark gesüßt', true),
}

const FRUCTOSE_OMIT = new Set(['datteln', 'rosinen', 'feigen', 'artischocken'])

// ---------------------------------------------------------------- Leicht verdaulich (Schonkost)

const DIGEST_LIMITS: Record<string, true | number> = {
  kichererbsen: true, 'linsen-rot': 40, 'linsen-braun': true, belugalinsen: true, kidneybohnen: true,
  'schwarze-bohnen': true, 'weisse-bohnen': true, edamame: true, sojahack: true,
  weisskohl: true, rotkohl: true, rosenkohl: true, gruenkohl: true, sauerkraut: true, blumenkohl: true,
  brokkoli: 60, champignons: 40, pilze: 40, paprika: 40, gurke: 50, radieschen: true, essiggurken: true,
  zwiebel: 25, knoblauch: 4, lauch: 30, oliven: 15, kapern: 8, 'getrocknete-tomaten': 12,
  chili: true, chiliflocken: true, sriracha: true, 'sambal-oelek': true, harissa: true, currypaste: true,
  weisswein: true, rotwein: true, bier: true, kaffee: true,
  speck: true, salami: true, chorizo: true, bratwurst: true, wuerstchen: true, mayonnaise: 20,
  vollkornmehl: true, granola: true, mandeln: 20, walnuesse: 20, haselnuesse: 20, erdnuesse: 20,
  cashews: 20, pistazien: 20,
}

const DIGEST_SUBS: Record<string, Sub> = {
  weisswein: sub('Gemüsebrühe', undefined, true), rotwein: sub('Gemüsebrühe', undefined, true), bier: sub('Gemüsebrühe', undefined, true),
  kaffee: sub('Getreidekaffee', undefined, true),
  weisskohl: sub('Zucchini', undefined, true), rotkohl: sub('gedünstete Karotten', undefined, true), rosenkohl: sub('Zucchini', undefined, true),
  gruenkohl: sub('Blattspinat', undefined, true), blumenkohl: sub('Zucchini', undefined, true), brokkoli: sub('Zucchini', undefined, true),
  sauerkraut: sub('gedünstete Karotten', undefined, true), champignons: sub('Zucchini', undefined, true), pilze: sub('Zucchini', undefined, true),
  paprika: sub('geschälte Karotte', undefined, true), gurke: sub('geschälte Gurke ohne Kerne'),
  zwiebel: sub('das Grün von Lauchzwiebeln', undefined, true), lauch: sub('nur das Lauchgrün, gut gedünstet', undefined, true),
  knoblauch: sub('Knoblauchöl', undefined, true),
  currypaste: sub('mildes Currypulver'), sriracha: sub('etwas Paprikapulver'),
  harissa: sub('mildes Paprikapulver'), 'sambal-oelek': sub('mildes Paprikapulver'),
  vollkornmehl: sub('helles Weizenmehl'), granola: sub('feine Haferflocken', undefined, true),
  speck: sub('magerer Kochschinken', undefined, true), salami: sub('magerer Kochschinken', undefined, true), chorizo: sub('magerer Kochschinken', undefined, true),
  bratwurst: sub('Geflügelbrät oder mageres Hackfleisch', undefined, true), wuerstchen: sub('Geflügelwürstchen', undefined, true),
  mayonnaise: sub('Joghurtdressing'),
  mandeln: sub('gemahlene Mandeln', 'fein gemahlen sind Nüsse deutlich bekömmlicher', true),
  walnuesse: sub('gemahlene Mandeln', undefined, true), haselnuesse: sub('gemahlene Haselnüsse', undefined, true),
  'linsen-rot': sub('rote Linsen, sehr weich gekocht', 'geschälte rote Linsen sind die bekömmlichsten Hülsenfrüchte'),
  kichererbsen: sub('sehr weich gekochte rote Linsen', undefined, true),
  'linsen-braun': sub('geschälte rote Linsen, sehr weich gekocht', 'ohne Schale sind Linsen deutlich bekömmlicher'),
  sojahack: sub('mageres Hackfleisch oder Seidentofu'),
}

const DIGEST_OMIT = new Set([
  'chili', 'chiliflocken', 'oliven', 'kapern', 'essiggurken', 'radieschen', 'getrocknete-tomaten',
  'kidneybohnen', 'schwarze-bohnen', 'weisse-bohnen', 'belugalinsen', 'edamame', 'erdnuesse', 'cashews', 'pistazien',
])

// ---------------------------------------------------------------- Vegetarisch und vegan

const MEAT = ['haehnchenbrust', 'haehnchenschenkel', 'hackfleisch', 'rinderhack', 'rindfleisch', 'rindersteak',
  'schweinefleisch', 'schweineschnitzel', 'speck', 'schinken', 'salami', 'bratwurst', 'wuerstchen', 'chorizo',
  'putenbrust', 'lamm', 'ente', 'kasseler']
const FISH = ['lachs', 'raeucherlachs', 'thunfisch-dose', 'thunfischsteak', 'garnelen', 'kabeljau', 'forelle',
  'seelachs', 'hering', 'muscheln', 'tintenfisch', 'sardellen', 'dorade']

const VEGETARIAN_LIMITS: Record<string, true | number> = Object.fromEntries(
  [...MEAT, ...FISH, 'huehnerbruehe', 'fischsauce', 'gelatine', 'worcestersauce'].map((k) => [k, true as const]),
)

/** Ersatz nur, wo er kulinarisch trägt. Ganze Fleisch- und Fischstücke bleiben bewusst ohne. */
const VEGETARIAN_SUBS: Record<string, Sub> = {
  huehnerbruehe: sub('Gemüsebrühe'),
  fischsauce: sub('Sojasauce mit einem Spritzer Limette'),
  gelatine: sub('Agar-Agar', '1 gestrichener TL auf 250 ml Flüssigkeit, kurz aufkochen lassen'),
  worcestersauce: sub('vegetarische Worcestersauce', 'die übliche enthält Sardellen'),
  hackfleisch: sub('Sojahack', undefined, true), rinderhack: sub('Sojahack', undefined, true),
  speck: sub('Räuchertofu', undefined, true), schinken: sub('Räuchertofu', undefined, true),
  salami: sub('vegetarische Salami', undefined, true),
  chorizo: sub('Räuchertofu mit Paprikapulver', undefined, true),
  bratwurst: sub('vegetarische Bratwurst', undefined, true),
  wuerstchen: sub('vegetarische Würstchen', undefined, true),
  haehnchenbrust: sub('fester Tofu oder Sojaschnetzel', undefined, true),
  putenbrust: sub('fester Tofu oder Sojaschnetzel', undefined, true),
  haehnchenschenkel: sub('Austernpilze', undefined, true),
  sardellen: sub('ein Löffel helles Miso', 'bringt dieselbe herzhafte Tiefe', true),
  garnelen: sub('Kräuterseitlinge', undefined, true),
  'thunfisch-dose': sub('zerdrückte Kichererbsen', undefined, true),
}

const DAIRY_VEGAN: Record<string, Sub> = {
  milch: sub('Hafermilch'), sahne: sub('Hafercreme zum Kochen'), schmand: sub('Sojajoghurt'),
  'creme-fraiche': sub('vegane Crème fraîche'), joghurt: sub('Sojajoghurt'),
  'griechischer-joghurt': sub('Sojajoghurt', 'kurz abtropfen lassen, dann wird er cremiger'),
  quark: sub('abgetropfter Sojajoghurt'), skyr: sub('abgetropfter Sojajoghurt'),
  huettenkaese: sub('zerbröselter Seidentofu'), frischkaese: sub('veganer Frischkäse'),
  mozzarella: sub('veganer Pizzakäse'), feta: sub('marinierter Räuchertofu', undefined, true), parmesan: sub('Hefeflocken', undefined, true),
  gouda: sub('veganer Käse'), emmentaler: sub('veganer Käse'), cheddar: sub('veganer Cheddar'),
  ziegenkaese: sub('veganer Frischkäse', undefined, true), ricotta: sub('zerbröselter Seidentofu'),
  mascarpone: sub('Cashewcreme', undefined, true), halloumi: sub('gegrillter Räuchertofu', undefined, true),
  blauschimmelkaese: sub('veganer Käse', undefined, true), 'kaese-gerieben': sub('veganer Reibekäse'),
  buttermilch: sub('Hafermilch mit einem Spritzer Zitrone'), butter: sub('Margarine oder Kokosöl'),
  'eis-vanille': sub('veganes Vanilleeis'), milchreis: sub('Milchreis mit Hafermilch'),
  eier: sub('Leinsamen-Ei', '1 EL geschrotete Leinsamen mit 3 EL Wasser 10 Minuten quellen lassen, ersetzt ein Ei', true),
  honig: sub('Ahornsirup', undefined, true), mayonnaise: sub('vegane Mayonnaise'),
  butterkekse: sub('vegane Kekse'), loeffelbiskuits: sub('vegane Löffelbiskuits'),
  'mehlbutter-fertigteig': sub('veganer Blätterteig'),
}

const VEGAN_LIMITS: Record<string, true | number> = {
  ...VEGETARIAN_LIMITS,
  ...Object.fromEntries(Object.keys(DAIRY_VEGAN).map((k) => [k, true as const])),
}

// ---------------------------------------------------------------- Regelwerk

export const DIET_RULES: Partial<Record<Diet, DietRule>> = {
  glutenfrei: { limits: GLUTEN_LIMITS, subs: GLUTEN_SUBS, omit: new Set(), maxOmit: 2, maxChanges: 4 },
  laktosefrei: { limits: LACTOSE_LIMITS, subs: LACTOSE_SUBS, omit: new Set(), maxOmit: 2, maxChanges: 4 },
  lowfodmap: { limits: FODMAP_LIMITS, subs: FODMAP_SUBS, omit: FODMAP_OMIT, maxOmit: 2, maxChanges: 4 },
  fruktosefrei: { limits: FRUCTOSE_LIMITS, subs: FRUCTOSE_SUBS, omit: FRUCTOSE_OMIT, maxOmit: 2, maxChanges: 4 },
  leichtverdaulich: {
    limits: DIGEST_LIMITS, subs: DIGEST_SUBS, omit: DIGEST_OMIT, maxOmit: 3, maxChanges: 4,
    extra: (r) => (r.nutrition.fat > 25 ? 'zu fettreich für Schonkost' : null),
  },
  vegetarisch: { limits: VEGETARIAN_LIMITS, subs: VEGETARIAN_SUBS, omit: new Set(), maxOmit: 0, maxChanges: 2 },
  vegan: { limits: VEGAN_LIMITS, subs: { ...VEGETARIAN_SUBS, ...DAIRY_VEGAN }, omit: new Set(), maxOmit: 0, maxChanges: 5 },
}

/** Ernährungsformen, für die es Ersatz oder Weglassen gibt. Alle anderen filtern hart. */
export const ADAPTABLE = Object.keys(DIET_RULES) as Diet[]

/**
 * Weitere Wörter, an denen man erkennt, dass ein Gericht nach dieser Zutat benannt ist.
 * Nötig, weil Zutat und Gerichtname oft verschiedene Wortstämme haben
 * („Hühnerfrikassee“ besteht aus Hähnchenfleisch, „Aloo Gobi“ aus Blumenkohl).
 */
export const TITLE_ALIASES: Record<string, string[]> = {
  haehnchenbrust: ['huhn', 'huehn', 'haehnchen', 'hendl', 'poulet', 'chicken', 'gefluegel'],
  haehnchenschenkel: ['huhn', 'huehn', 'haehnchen', 'hendl', 'poulet', 'chicken', 'gefluegel'],
  putenbrust: ['pute', 'truthahn', 'turkey'],
  hackfleisch: ['hack', 'bolognese', 'frikadelle', 'koettbullar', 'cevapcici', 'bifteki', 'hackbraten', 'carne'],
  rinderhack: ['hack', 'bolognese', 'frikadelle', 'koettbullar', 'cevapcici', 'hackbraten', 'carne'],
  rindfleisch: ['rind', 'beef', 'gulasch', 'tafelspitz', 'sauerbraten', 'stroganoff'],
  schweinefleisch: ['schwein', 'pork', 'gyros', 'schaschlik', 'pfannengyros'],
  speck: ['speck', 'bacon', 'carbonara', 'lorraine'],
  schinken: ['schinken', 'croque', 'saltimbocca'],
  salami: ['salami', 'diavolo'],
  chorizo: ['chorizo'],
  bratwurst: ['bratwurst', 'wurst'],
  wuerstchen: ['wuerstchen', 'wurst', 'hot dog'],
  sardellen: ['sardellen', 'anchovis', 'puttanesca', 'caesar', 'nicoise'],
  garnelen: ['garnelen', 'gambas', 'scampi', 'shrimp'],
  'thunfisch-dose': ['thunfisch', 'tuna', 'nicoise'],
  blumenkohl: ['blumenkohl', 'gobi', 'karfiol'],
  weisskohl: ['kohl', 'kraut', 'coleslaw', 'krautsalat'],
  rotkohl: ['rotkohl', 'blaukraut'],
  sauerkraut: ['sauerkraut', 'choucroute'],
  kichererbsen: ['kichererbsen', 'falafel', 'hummus', 'chana'],
  linsen: ['linsen', 'dal', 'dahl'],
  'linsen-rot': ['linsen', 'dal', 'dahl'],
  'linsen-braun': ['linsen', 'dal', 'dahl'],
  mascarpone: ['mascarpone', 'tiramisu'],
  parmesan: ['parmesan', 'cacio', 'carbonara'],
  kaffee: ['kaffee', 'espresso', 'affogato', 'latte'],
  weisswein: ['wein', 'risotto'],
  rotwein: ['wein', 'coq au vin'],
  bier: ['bier', 'biersosse'],
  zwiebel: ['zwiebel', 'zwiebelkuchen'],
  knoblauch: ['knoblauch', 'aglio'],
  champignons: ['pilz', 'champignon', 'funghi'],
  pilze: ['pilz', 'champignon', 'funghi'],
  spargel: ['spargel'],
  apfel: ['apfel', 'aepfel', 'apple', 'bratapfel'],
  pfirsich: ['pfirsich', 'melba'],
  ananas: ['ananas'],
  trauben: ['trauben', 'weintrauben'],
  suesskartoffel: ['suesskartoffel', 'sweet potato'],
  avocado: ['avocado', 'guacamole'],
  eier: ['ei', 'eier', 'omelett', 'ruehrei', 'frittata', 'benedict', 'menemen', 'tortilla'],
  butter: ['butter', 'butterkuchen'],
  milch: ['milch', 'milchreis'],
  honig: ['honig'],
  zucker: ['zuckerkuchen'],
}

/** Zutaten eines Rezepts, die gegen die Ernährungsform verstoßen (ohne optionale). */
export function offendingIngredients(ingredients: Ingredient[], servings: number, diet: Diet): Ingredient[] {
  const rule = DIET_RULES[diet]
  if (!rule) return []
  return ingredients.filter((i) => !i.optional && violates(i, servings, rule))
}

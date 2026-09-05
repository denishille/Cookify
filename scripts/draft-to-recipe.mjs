#!/usr/bin/env node
// Wandelt Importentwürfe in App-Rezepte um: Zutaten auf die bekannten Schlüssel abbilden,
// Schritte von der Portionsschreibweise der Quelle befreien, Nährwerte je Portion schätzen.
// Titel und Beschreibung kommen aus einer Begleitdatei (siehe --meta), alles andere wird abgeleitet.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const _importsDir = join(root, 'src/data/imports')
const ingredients = JSON.parse(readFileSync(join(root, 'src/data/ingredients.json'), 'utf8'))
const aliases = JSON.parse(readFileSync(join(root, 'scripts/lib/ingredient-aliases.json'), 'utf8'))
const nutriTable = JSON.parse(readFileSync(join(root, 'scripts/lib/nutrition-table.json'), 'utf8'))

const defs = Object.values(ingredients).flat()
const norm = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Akzente wie in „Crème“ oder „Jalapeño“
  .replace(/[^a-z0-9]+/g, ' ').trim()
const byNorm = new Map()
for (const d of defs) { byNorm.set(norm(d.name), d.key); byNorm.set(norm(d.key), d.key) }
const _STAPLES = new Set(defs.filter((d) => d.staple).map((d) => d.key))

const strip = (s) => norm(s)
  .replace(/\b(frisch|frische|frischer|frisches|bio|gewachst|geraspelt|gerieben|geriebener|gehackt|gehackter|vegan|vegane|veganer|mild|milder|jung|junger|ital art|d o p|nach geschmack|vorgekocht|vorw festk|mehligk|tk|tiefgefroren|halb|ganze|ganz|stueck|dose od glas|dose|glas|el|tl)\b/g, ' ')
  .replace(/\s+/g, ' ').trim()

/** Ordnet einen Zutatennamen einem bekannten Schlüssel zu. */
export function keyFor(name) {
  const n = strip(name)
  if (aliases[n]) return aliases[n]
  if (aliases[norm(name)]) return aliases[norm(name)]
  if (byNorm.has(n)) return byNorm.get(n)
  // Deutsche Zusammensetzungen tragen das Grundwort am Ende: „Butterbohnen“ sind Bohnen,
  // keine Butter. Deshalb zuerst am Wortende suchen, erst danach irgendwo im Namen.
  let best = null, len = 0
  for (const [k, key] of byNorm) if (k.length > 3 && n.endsWith(k) && k.length > len) { best = key; len = k.length }
  if (best) return best
  for (const [k, key] of byNorm) if (k.length > 3 && n.includes(k) && k.length > len) { best = key; len = k.length }
  if (best) return best
  for (const [k, key] of byNorm) if (k.length > 4 && k.includes(n) && n.length > 3) return key
  return null
}

const UNITS = { esslöffel: 'EL', teelöffel: 'TL', el: 'EL', tl: 'TL', g: 'g', kg: 'kg', ml: 'ml', l: 'l', stück: 'Stück', prise: 'Prise', bund: 'Bund', packung: 'Packung', zehe: 'Zehe', scheibe: 'Scheibe', dose: 'Dose', handvoll: 'Handvoll' }

/** Zerlegt „400 g Kartoffeln (Drillinge)“ in Menge, Einheit und Namen. */
export function parseIngredient(raw) {
  const line = raw.replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/⅓/g, '0.33').replace(/¾/g, '0.75').replace(/⅕/g, '0.2').replace(/⅔/g, '0.66')
  const m = /^\s*([\d]+[.,]?[\d]*)?\s*(Esslöffel|Teelöffel|EL|TL|g|kg|ml|l|Stück|Prise|Bund|Packung|Zehe\(n\)|Zehe|Scheibe|Dose|Handvoll|nach Geschmack)?\s*(.*)$/i.exec(line.trim())
  if (!m) return null
  const amountRaw = m[1] ? Number(m[1].replace(',', '.')) : null
  const unitRaw = (m[2] ?? '').toLowerCase().replace('(n)', '')
  let amount = amountRaw, unit = UNITS[unitRaw] ?? ''
  if (unitRaw === 'kg' && amount) { amount *= 1000; unit = 'g' }
  if (unitRaw === 'l' && amount) { amount *= 1000; unit = 'ml' }
  const name = m[3].replace(/\s+/g, ' ').trim()
  if (!name) return null
  return { amount: Number.isFinite(amount) ? amount : null, unit, name }
}

/** Ungefähres Gewicht einer Zutatenangabe in Gramm – für die Nährwertschätzung. */
const PIECE = { zwiebel: 120, schalotte: 40, knoblauch: 5, karotte: 90, kartoffel: 90, tomate: 100, paprika: 160, zucchini: 250, aubergine: 300, gurke: 350, avocado: 150, zitrone: 100, limette: 60, orange: 180, apfel: 150, banane: 120, mango: 300, brokkoli: 400, blumenkohl: 700, kuerbis: 900, fenchel: 250, lauch: 250, suesskartoffel: 250, eier: 60, chili: 15, fruehlingszwiebel: 30, salat: 200, 'pak-choi': 150, mozzarella: 125, tortillas: 40, broetchen: 70, naan: 90, pita: 60, granatapfel: 300, 'rote-bete': 150, pastinake: 150, mais: 150, wassermelone: 1000, blaetterteig: 40, wrap: 60, toastbrot: 25, baguette: 250 }
const GRAMS = { g: 1, ml: 1, EL: 12, TL: 5, Prise: 0.5, Bund: 25, Packung: 200, Zehe: 5, Scheibe: 25, Handvoll: 25, Dose: 400 }
/** Wie viel wiegt eine Zutatenzeile ungefähr? Notfalls gedeckelt, damit ein Tippfehler
 *  in der Quelle („250 Dose Kokosmilch“) die Nährwerte nicht ins Absurde treibt. */
function gramsOf(ing) {
  if (ing.amount === null) return 2
  let g
  if (ing.unit === 'Stück') g = ing.amount * (PIECE[ing.key] ?? 100)
  // Ohne Einheit ist eine große Zahl fast immer eine Grammangabe, eine kleine ein Stück.
  else if (ing.unit === '') g = ing.amount >= 20 ? ing.amount : ing.amount * (PIECE[ing.key] ?? 100)
  // „250 Dose Kokosmilch“ meint 250 ml, nicht 250 Dosen.
  else if ((ing.unit === 'Dose' || ing.unit === 'Packung') && ing.amount >= 20) g = ing.amount
  else g = ing.amount * (GRAMS[ing.unit] ?? 100)
  const cap = FAT_OR_SPICE.has(ing.key) ? 120 : 1200
  return Math.min(g, cap)
}
/** Bei Fett und Gewürzen fällt eine falsche Menge am stärksten ins Gewicht. */
const FAT_OR_SPICE = new Set(['butter', 'olivenoel', 'pflanzenoel', 'sesamoel', 'kokosoel', 'margarine', 'mayonnaise', 'zucker', 'salz', 'pfeffer', 'honig', 'ahornsirup', 'senf', 'sojasauce', 'essig', 'balsamico', 'currypaste', 'tomatenmark', 'paprikapulver', 'currypulver', 'zimt', 'chili'])

/** Nährwerte je Portion aus den Zutaten schätzen. */
export function estimateNutrition(list, servings) {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const ing of list) {
    const per100 = nutriTable.keys[ing.key] ?? nutriTable.standard
    const g = gramsOf(ing)
    for (const k of Object.keys(sum)) sum[k] += (per100[k] * g) / 100
  }
  const round = (v) => Math.round(v / servings)
  return { kcal: Math.round(sum.kcal / servings / 5) * 5, protein: round(sum.protein), carbs: round(sum.carbs), fat: round(sum.fat) }
}

/** Portionsschreibweise, Sternchen und Werbefloskeln aus den Schritten der Quelle entfernen. */
export function cleanStep(s) {
  return s
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\*/g, '')
    .replace(/\bTipp:.*$/i, '')
    .replace(/\b(KRUPS|Thermomix|Mixtopf|Cook4Me)[^.]*\./gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

const MEAT = new Set(['rindfleisch', 'rindersteak', 'rinderfilet', 'kalbfleisch', 'schweinefleisch', 'schweineschnitzel', 'lamm', 'ente', 'kaninchen', 'leber', 'kasseler', 'hackfleisch', 'rinderhack', 'haehnchenbrust', 'haehnchenschenkel', 'haehnchenfluegel', 'putenbrust', 'speck', 'schinken', 'salami', 'chorizo', 'bratwurst', 'wuerstchen', 'lachs', 'raeucherlachs', 'thunfisch-dose', 'thunfischsteak', 'kabeljau', 'seelachs', 'zander', 'scholle', 'forelle', 'dorade', 'makrele', 'sardinen', 'sardellen', 'hering', 'garnelen', 'muscheln', 'jakobsmuscheln', 'tintenfisch', 'huehnerbruehe', 'fischsauce', 'gelatine'])
const ANIMAL = new Set(['milch', 'butter', 'sahne', 'schmand', 'creme-fraiche', 'saure-sahne', 'creme-double', 'joghurt', 'griechischer-joghurt', 'quark', 'skyr', 'huettenkaese', 'frischkaese', 'mozzarella', 'burrata', 'feta', 'parmesan', 'gouda', 'cheddar', 'emmentaler', 'bergkaese', 'camembert', 'blauschimmelkaese', 'ziegenkaese', 'ricotta', 'mascarpone', 'halloumi', 'kaese-gerieben', 'buttermilch', 'kefir', 'ayran', 'kondensmilch', 'eier', 'honig', 'mayonnaise', 'eis-vanille'])

export function dietFor(keys) {
  if (keys.some((k) => MEAT.has(k))) return []
  if (keys.some((k) => ANIMAL.has(k))) return ['vegetarisch']
  return ['vegetarisch', 'vegan']
}

/** Küche aus Titel und Zutaten raten. */
export function cuisineFor(title, keys) {
  const t = title.toLowerCase()
  const has = (...k) => k.some((x) => keys.includes(x))
  if (/thai|asia|wok|teriyaki|ramen|soba|gyoza|pak choi|bao|katsu/.test(t) || has('sojasauce', 'sesamoel', 'pak-choi', 'reisnudeln')) return 'asiatisch'
  if (/curry|masala|tikka|dal|korma|naan|biryani/.test(t) || has('garam-masala', 'currypaste', 'naan')) return 'indisch'
  if (/taco|burrito|quesadilla|fajita|enchilada|chili sin|guacamole|mexi/.test(t)) return 'mexikanisch'
  if (/pasta|spaghetti|gnocchi|risotto|pizza|carbonara|pesto|parmigiana|linguine|penne|lasagne/.test(t) || has('gnocchi', 'risottoreis', 'parmesan')) return 'italienisch'
  if (/falafel|hummus|couscous|shakshuka|tabbouleh|baharat|orientalisch|mezze|tahin/.test(t) || has('tahini', 'couscous', 'ras-el-hanout')) return 'orientalisch'
  if (/burger|bbq|mac and cheese|mac & cheese|wedges|pulled/.test(t)) return 'amerikanisch'
  if (/ratatouille|quiche|gratin|tarte|bourguignon/.test(t)) return 'franzoesisch'
  if (/schnitzel|knödel|knoedel|spätzle|spaetzle|schupfnudel|eintopf|frikassee|rouladen|kohl/.test(t)) return 'deutsch'
  if (/feta|halloumi|oliven|mediterran|griechisch|tzatziki|caprese/.test(t) || has('feta', 'halloumi', 'oliven')) return 'mediterran'
  return 'international'
}

/** Kategorie aus Titel und Zutaten raten. */
export function categoryFor(title, _keys) {
  const t = title.toLowerCase()
  if (/suppe|eintopf|ramen|brühe|bruehe|creme-suppe/.test(t)) return 'suppe'
  if (/salat|bowl mit salat|tabbouleh|coleslaw/.test(t)) return 'salat'
  // „Flammkuchen“ und „Pestocreme“ sind keine Nachspeisen – deshalb genau hinschauen.
  if (/(?<!flamm)kuchen|dessert|crème brûlée|mousse au|tiramisu|pudding|waffel|pancake|muffin|brownie|torte|eis am stiel|kompott|nachtisch/.test(t)) return 'nachspeise'
  if (/frühstück|fruehstueck|porridge|smoothie|granola|müsli|muesli|omelett|rührei|ruehrei/.test(t)) return 'fruehstueck'
  if (/dip|snack|fingerfood|frühlingsrolle|fruehlingsrolle|bruschetta|cracker/.test(t)) return 'snack'
  return 'hauptgericht'
}

/** Schwierigkeit grob aus Zeit und Schrittzahl. */
export function difficultyFor(minutes, steps) {
  if (minutes <= 25 && steps <= 6) return 'einfach'
  if (minutes >= 45 || steps >= 8) return 'anspruchsvoll'
  return 'mittel'
}

// Erkennt Platzhalter- und Logobilder, die manche Rezeptseiten statt eines Fotos ausliefern.
// Zwei Wege: harte Liste bekannter Platzhalter (dHash) und eine Heuristik für flache Grafiken.

/** Bekannte Platzhalter der Quellseiten, als dHash (siehe dhash()). */
export const KNOWN_PLACEHOLDERS = [
  '9caca6fae6e6baba', // essen-und-trinken.de – Gemüsekranz mit Logo
  '204c2a968e480c0c', // lecker.de/kuechengoetter.de – geflügelte Gabel
]

/** 64-Bit-Differenzhash als Hex-String: robust gegen Skalierung und Requantisierung. */
export async function dhash(sharp, input) {
  const d = await sharp(input).resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer()
  let h = 0n
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | BigInt(d[y * 9 + x] > d[y * 9 + x + 1] ? 1n : 0n)
  return h.toString(16).padStart(16, '0')
}

export function hamming(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0
  while (x) { n += Number(x & 1n); x >>= 1n }
  return n
}

/** Farbvielfalt und Kontrast eines Bildes – Logos sind flach, Fotos nicht. */
export async function imageStats(sharp, input) {
  const { data, info } = await sharp(input).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = 32 * 32, ch = info.channels
  const colours = new Set()
  let sum = 0, sum2 = 0
  for (let i = 0; i < n; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2]
    colours.add(((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5))
    const l = r * 0.299 + g * 0.587 + b * 0.114
    sum += l; sum2 += l * l
  }
  const mean = sum / n
  return { colours: colours.size, contrast: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) }
}

/**
 * Prüft ein Bild (Buffer oder Pfad) auf Platzhalter.
 * @returns {Promise<string|null>} Grund, wenn es ein Platzhalter ist, sonst null.
 */
export async function placeholderReason(sharp, input) {
  const h = await dhash(sharp, input)
  for (const p of KNOWN_PLACEHOLDERS) if (hamming(h, p) <= 4) return 'bekannter Platzhalter der Quellseite'
  const { colours, contrast } = await imageStats(sharp, input)
  // Echte Fotos liegen im Bestand bei mindestens 31 Farben und Kontrast 29.
  if (colours < 20) return `nur ${colours} Farben – sieht nach Logo/Grafik aus`
  if (contrast < 18) return `Kontrast ${contrast.toFixed(1)} – fast einfarbig`
  return null
}

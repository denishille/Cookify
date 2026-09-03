#!/usr/bin/env node
// Erzeugt das Cookify-Logo als fontunabhängige SVG-Pfade:
//   public/logo.svg            Bildmarke + Wortmarke
//   public/favicon.svg         Bildmarke
//   src/components/logo-paths.ts   Pfaddaten für die React-Komponente
// Schrift: Fredoka SemiBold (rund, freundlich). Die Buchstaben sitzen auf einem
// leichten Bogen und sind minimal mitgedreht – der „Schwung“.
import * as fontkit from 'fontkit'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const font = fontkit.openSync(join(root, 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2'))

const GREEN = '#067a46'
const LIME = '#b9df4a'
const SIZE = 100                       // Schriftgröße in SVG-Einheiten
const s = SIZE / font.unitsPerEm
const AMP = 5.5                        // Bogenhöhe (positiv = Mitte tiefer, Enden höher → freundlicher Schwung)
const TRACK = -1.5                     // leicht engere Laufweite

/** Pfad eines Glyphs in SVG-Koordinaten (y nach unten), skaliert, verschoben. */
function glyphPath(glyph, x, y) {
  const cmds = []
  for (const c of glyph.path.commands) {
    const a = c.args.map((v, i) => (i % 2 === 0 ? x + v * s : y - v * s))
    switch (c.command) {
      case 'moveTo': cmds.push(`M${a[0].toFixed(2)} ${a[1].toFixed(2)}`); break
      case 'lineTo': cmds.push(`L${a[0].toFixed(2)} ${a[1].toFixed(2)}`); break
      case 'quadraticCurveTo': cmds.push(`Q${a.map((v) => v.toFixed(2)).join(' ')}`); break
      case 'bezierCurveTo': cmds.push(`C${a.map((v) => v.toFixed(2)).join(' ')}`); break
      case 'closePath': cmds.push('Z'); break
    }
  }
  return cmds.join('')
}

// ---- Wortmarke ----
const run = font.layout('Cookıfy')  // ı ohne Punkt, der Punkt wird als Limetten-Kreis gesetzt
const advances = run.positions.map((p) => p.xAdvance * s + TRACK)
const total = advances.reduce((a, b) => a + b, 0) - TRACK
const mid = total / 2
const half = total / 2
const baseline = 78
const letters = []
let x = 0
run.glyphs.forEach((g, i) => {
  const cx = x + (g.advanceWidth * s) / 2
  const t = (cx - mid) / half                       // -1 .. 1
  const dy = AMP * (1 - t * t)                      // Parabel: Mitte tiefer
  const slope = (-2 * AMP * t) / half                // Ableitung
  const rot = (Math.atan(slope) * 180) / Math.PI
  letters.push({ d: glyphPath(g, x, baseline + dy), cx, cy: baseline + dy, rot, name: g.name, x, dy })
  x += advances[i]
})
const dotless = letters[4]
const dotX = dotless.x + (font.getGlyph(font.glyphForCodePoint(0x131).id).advanceWidth * s) / 2
const dotY = dotless.cy - (font.xHeight * s) - 14
const dotR = 8.5

const wordW = Math.ceil(total) + 4
const wordH = 100
const wordmarkInner = letters.map((l) =>
  `<path d="${l.d}" transform="rotate(${l.rot.toFixed(2)} ${l.cx.toFixed(2)} ${l.cy.toFixed(2)})"/>`).join('\n    ')
const dot = `<circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotR}" fill="${LIME}"/>`

// ---- Bildmarke: abgerundetes Quadrat, weißes C, Limetten-Punkt ----
const MARK = 100
const cGlyph = font.glyphsForString('C')[0]
const cW = cGlyph.advanceWidth * s * 0.78
const cScale = 0.78
function glyphPathScaled(glyph, x, y, k) {
  const cmds = []
  for (const c of glyph.path.commands) {
    const a = c.args.map((v, i) => (i % 2 === 0 ? x + v * s * k : y - v * s * k))
    switch (c.command) {
      case 'moveTo': cmds.push(`M${a[0].toFixed(2)} ${a[1].toFixed(2)}`); break
      case 'lineTo': cmds.push(`L${a[0].toFixed(2)} ${a[1].toFixed(2)}`); break
      case 'quadraticCurveTo': cmds.push(`Q${a.map((v) => v.toFixed(2)).join(' ')}`); break
      case 'bezierCurveTo': cmds.push(`C${a.map((v) => v.toFixed(2)).join(' ')}`); break
      case 'closePath': cmds.push('Z'); break
    }
  }
  return cmds.join('')
}
const cX = (MARK - cW) / 2 - 6
const cY = MARK / 2 + (font.capHeight * s * cScale) / 2
const markC = glyphPathScaled(cGlyph, cX, cY, cScale)
const markDot = { cx: 77, cy: 25, r: 8.5 }

const markSvg = (withBg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK} ${MARK}">
  ${withBg ? `<rect width="${MARK}" height="${MARK}" rx="26" fill="${GREEN}"/>` : ''}
  <path d="${markC}" fill="#ffffff"/>
  <circle cx="${markDot.cx}" cy="${markDot.cy}" r="${markDot.r}" fill="${LIME}"/>
</svg>
`

const GAP = 22
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK + GAP + wordW} ${wordH}" role="img" aria-label="Cookify">
  <rect width="${MARK}" height="${MARK}" rx="26" fill="${GREEN}"/>
  <path d="${markC}" fill="#ffffff"/>
  <circle cx="${markDot.cx}" cy="${markDot.cy}" r="${markDot.r}" fill="${LIME}"/>
  <g transform="translate(${MARK + GAP} 0)" fill="${GREEN}">
    ${wordmarkInner}
    ${dot}
  </g>
</svg>
`

writeFileSync(join(root, 'public/logo.svg'), logoSvg)
writeFileSync(join(root, 'public/favicon.svg'), markSvg())
writeFileSync(join(root, 'src/components/logo-paths.ts'), `// Generiert von scripts/make-logo.mjs – nicht von Hand bearbeiten.
export const MARK_VIEWBOX = '0 0 ${MARK} ${MARK}'
export const MARK_C = '${markC}'
export const MARK_DOT = { cx: ${markDot.cx}, cy: ${markDot.cy}, r: ${markDot.r} }
export const WORD_VIEWBOX = '0 0 ${wordW} ${wordH}'
export const WORD_LETTERS: { d: string; rot: number; cx: number; cy: number }[] = ${JSON.stringify(letters.map((l) => ({ d: l.d, rot: +l.rot.toFixed(2), cx: +l.cx.toFixed(2), cy: +l.cy.toFixed(2) })))}
export const WORD_DOT = { cx: ${dotX.toFixed(2)}, cy: ${dotY.toFixed(2)}, r: ${dotR} }
`)
console.log(`Wortmarke ${wordW}×${wordH}, Logo ${MARK + GAP + wordW}×${wordH}`)

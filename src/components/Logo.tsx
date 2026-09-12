import { MARK_C, MARK_DOT, MARK_VIEWBOX, WORD_DOT, WORD_LETTERS, WORD_VIEWBOX } from './logo-paths'

/** Bildmarke: grünes Quadrat, weißes C, Limetten-Punkt. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden>
      <rect width="100" height="100" rx="26" fill="var(--green)" />
      <path d={MARK_C} fill="#ffffff" />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill="var(--lime)" />
    </svg>
  )
}

/** Wortmarke „Cookify“ als Pfade, unabhängig von geladenen Schriften. */
export function Wordmark({ height = 26 }: { height?: number }) {
  const [, , w, h] = WORD_VIEWBOX.split(' ').map(Number)
  return (
    <svg height={height} width={(height * w) / h} viewBox={WORD_VIEWBOX} role="img" aria-label="Cookify">
      <g fill="var(--green)">
        {WORD_LETTERS.map((l, i) => <path key={i} d={l.d} transform={`rotate(${l.rot} ${l.cx} ${l.cy})`} />)}
        <circle cx={WORD_DOT.cx} cy={WORD_DOT.cy} r={WORD_DOT.r} fill="var(--lime)" />
      </g>
    </svg>
  )
}

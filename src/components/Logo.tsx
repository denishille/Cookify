import { MARK_BOWL, MARK_LEAVES, MARK_RIM, MARK_VIEWBOX, WORD_DOT, WORD_LETTERS, WORD_VIEWBOX } from './logo-paths'

/**
 * Bildmarke: grünes Quadrat, weiße Schale, Keimling in Limette.
 *
 * Die Farben stehen fest und folgen nicht der Hell/Dunkel-Umschaltung – ein Zeichen soll
 * überall gleich aussehen, und auf dunklem Grund trägt das Quadrat sich selbst.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden>
      <rect width="100" height="100" rx="26" fill="#067a46" />
      <rect x={MARK_RIM.x} y={MARK_RIM.y} width={MARK_RIM.w} height={MARK_RIM.h} rx={MARK_RIM.r} fill="#ffffff" />
      <path d={MARK_BOWL} fill="#ffffff" />
      {MARK_LEAVES.map((d) => <path key={d} d={d} fill="#b9df4a" />)}
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

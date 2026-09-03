import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

export const IconClock = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
export const IconFilter = (p: P) => <svg {...base} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
export const IconCheck = (p: P) => <svg {...base} {...p}><path d="m5 12 4 4L19 6" /></svg>
export const IconX = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
export const IconPlus = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
export const IconMinus = (p: P) => <svg {...base} {...p}><path d="M5 12h14" /></svg>
export const IconChevronLeft = (p: P) => <svg {...base} {...p}><path d="m15 6-6 6 6 6" /></svg>
export const IconChevronDown = (p: P) => <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
export const IconShare = (p: P) => <svg {...base} {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5" /></svg>
export const IconFlame = (p: P) => <svg {...base} {...p}><path d="M12 3s5 4.5 5 9.5A5 5 0 0 1 7 12.5C7 9 9 7 9 7s.5 2.5 2 3c0-3 1-7 1-7z" /></svg>
export const IconGauge = (p: P) => <svg {...base} {...p}><path d="M5 17a8 8 0 1 1 14 0" /><path d="m12 13 3-4" /></svg>
export const IconGlobe = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
export const IconDice = (p: P) => <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
export const IconBook = (p: P) => <svg {...base} {...p}><path d="M4 5a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" /><path d="M4 17a2 2 0 0 1 2-2h13" /></svg>
export const IconBasket = (p: P) => <svg {...base} {...p}><path d="M3 10h18l-1.5 9a2 2 0 0 1-2 1.7h-11a2 2 0 0 1-2-1.7z" /><path d="m8 10 3-6M16 10l-3-6" /></svg>
export const IconSparkle = (p: P) => <svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
export const IconUsers = (p: P) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.5a5 5 0 0 1 5.5 4.5" /></svg>

export const IconStar = (p: P) => <svg {...base} {...p} fill="currentColor" stroke="none"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
export const IconExternal = (p: P) => <svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>

export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-9.6-9.3A5.2 5.2 0 0 1 12 6.4a5.2 5.2 0 0 1 9.6 4.8C19.5 15.9 12 20.5 12 20.5z" />
  </svg>
)

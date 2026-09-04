import { useRef, type ReactNode } from 'react'
import { useScrollMemory } from '../lib/scrollMemory'

/** Waagerecht scrollende Kachelreihe, die ihre Position über einen Seitenwechsel hinweg behält. */
export function ScrollStrip({ storeKey, children }: { storeKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollMemory(`strip:${storeKey}`, ref)
  return <div className="strip" ref={ref}>{children}</div>
}

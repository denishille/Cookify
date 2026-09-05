import { useCallback, useEffect, useState } from 'react'

/** Wert aus dem localStorage lesen – auch außerhalb von Hooks nutzbar. */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const read = readStored

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Speicher voll oder blockiert: still weiterlaufen
  }
}

/** useState, das in localStorage persistiert. */
export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  useEffect(() => write(key, value), [key, value])
  return [value, setValue] as const
}

/** Set<string> in localStorage (als Array gespeichert). */
export function usePersistentSet(key: string) {
  const [arr, setArr] = usePersistentState<string[]>(key, [])
  const set = new Set(arr)
  const toggle = useCallback(
    (item: string) =>
      setArr((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item])),
    [setArr],
  )
  const clear = useCallback(() => setArr([]), [setArr])
  const replace = useCallback((items: string[]) => setArr([...new Set(items)]), [setArr])
  return { set, toggle, clear, replace, has: (item: string) => set.has(item) }
}

/**
 * Set<string>, das nur für diese Sitzung gilt: beim nächsten Öffnen der App ist es wieder
 * das, was `initial` liefert. Für den Vorrat, der immer aus den geladenen Sets kommt.
 */
export function useSessionSet(initial: () => string[]) {
  const [arr, setArr] = useState<string[]>(initial)
  const set = new Set(arr)
  const toggle = useCallback((item: string) => setArr((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item])), [])
  const clear = useCallback(() => setArr([]), [])
  const replace = useCallback((items: string[]) => setArr([...new Set(items)]), [])
  return { set, toggle, clear, replace, has: (item: string) => set.has(item) }
}

import { useCallback, useEffect, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

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

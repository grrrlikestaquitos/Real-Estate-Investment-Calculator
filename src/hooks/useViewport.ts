import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

/** Whether a CSS media query matches, kept live. False where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
  )
}

function keyboardInset(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
}

/**
 * Height (px) of whatever covers the bottom of the layout viewport, usually the
 * on-screen keyboard. A fixed bottom bar offset by this stays visible above it.
 */
export function useKeyboardInset(): number {
  return useSyncExternalStore((onChange) => {
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', onChange)
    viewport?.addEventListener('scroll', onChange)
    window.addEventListener('resize', onChange)
    return () => {
      viewport?.removeEventListener('resize', onChange)
      viewport?.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, keyboardInset)
}

/**
 * Whether the element is at least partly on screen; null until known (or where
 * IntersectionObserver is unavailable).
 */
export function useInView(ref: RefObject<Element | null>, enabled = true): boolean | null {
  const [inView, setInView] = useState<boolean | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
  return enabled ? inView : null
}

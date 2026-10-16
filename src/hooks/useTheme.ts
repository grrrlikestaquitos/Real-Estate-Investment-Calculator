import { useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** Keep in sync with the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'brrr-calculator/theme'

/** Browser chrome color per theme (matches --bg). */
const THEME_COLORS: Record<Theme, string> = { dark: '#282c34', light: '#f3f4f7' }

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia?.(LIGHT_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

function getSystemTheme(): Theme {
  return window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark'
}

/**
 * The active color theme: the viewer's saved choice, otherwise the OS setting
 * (followed live until they pick one).
 */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme)
  const system = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme)
  const theme = stored ?? system

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }, [theme])

  // Paper is white: print in the light theme, then put the viewer's theme back.
  useEffect(() => {
    const root = document.documentElement
    const toLight = () => {
      root.dataset.theme = 'light'
    }
    const restore = () => {
      root.dataset.theme = theme
    }
    const print = window.matchMedia?.('print')
    const onPrintChange = (e: MediaQueryListEvent) => (e.matches ? toLight() : restore())
    window.addEventListener('beforeprint', toLight)
    window.addEventListener('afterprint', restore)
    print?.addEventListener('change', onPrintChange)
    return () => {
      window.removeEventListener('beforeprint', toLight)
      window.removeEventListener('afterprint', restore)
      print?.removeEventListener('change', onPrintChange)
    }
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setStored(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }

  return { theme, toggleTheme }
}

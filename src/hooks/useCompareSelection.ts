import { useEffect, useState } from 'react'
import { loadHiddenFromCompare, saveHiddenFromCompare } from '../lib/storage'

/**
 * Which deals appear in the comparison. Tracks the ones left out, so new and
 * imported deals are included by default. Persisted across visits.
 */
export function useCompareSelection() {
  const [hidden, setHidden] = useState<string[]>(loadHiddenFromCompare)

  useEffect(() => {
    saveHiddenFromCompare(hidden)
  }, [hidden])

  const hiddenSet = new Set(hidden)

  function toggle(id: string) {
    setHidden((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return {
    isIncluded: (id: string) => !hiddenSet.has(id),
    toggle,
  }
}

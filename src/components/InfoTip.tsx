import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { GlossaryEntry } from '../lib/glossary'

const GAP = 6
const EDGE = 8

/**
 * A small "?" button that explains a term in a popover. Closes on Escape or a
 * click elsewhere. The popover is fixed-position so scrolling containers don't
 * clip it, and it stays right after the button in reading order.
 */
export function InfoTip({ term, text }: GlossaryEntry) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)

  // Place it under the button (above when there's no room), kept on screen.
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const button = buttonRef.current
      const pop = popRef.current
      if (!button || !pop) return
      const anchor = button.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const left = Math.min(
        Math.max(EDGE, anchor.left + anchor.width / 2 - pop.offsetWidth / 2),
        viewportWidth - pop.offsetWidth - EDGE,
      )
      const below = anchor.bottom + GAP
      const fitsBelow = below + pop.offsetHeight <= window.innerHeight - EDGE
      pop.style.left = `${left}px`
      pop.style.top = `${fitsBelow ? below : Math.max(EDGE, anchor.top - GAP - pop.offsetHeight)}px`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="info-tip"
        aria-label={`What is ${term}?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open ? (
        <span ref={popRef} id={id} className="info-pop">
          {text}
        </span>
      ) : null}
    </>
  )
}

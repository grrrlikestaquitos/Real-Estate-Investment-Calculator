import { useCallback, useEffect, useRef, useState } from 'react'

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastMessage {
  id: number
  text: string
  tone?: 'error'
  action?: ToastAction
}

/** Toasts with an action (e.g. Undo) stay up longer so there is time to use it. */
const DURATION_MS = { plain: 3000, withAction: 7000 }

/** A single transient message, optionally with one action button. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const nextId = useRef(0)

  const show = useCallback(
    (text: string, options: { action?: ToastAction; tone?: 'error' } = {}) => {
      nextId.current += 1
      setToast({ id: nextId.current, text, ...options })
    },
    [],
  )

  const dismiss = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      toast.action ? DURATION_MS.withAction : DURATION_MS.plain,
    )
    return () => window.clearTimeout(timer)
  }, [toast])

  return { toast, show, dismiss }
}

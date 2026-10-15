import type { ToastMessage } from '../hooks/useToast'

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  // The live region stays mounted so screen readers announce each message.
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast ? (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`}>
          <span className="toast-text">{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.run()
                onDismiss()
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
            ×
          </button>
        </div>
      ) : null}
    </div>
  )
}

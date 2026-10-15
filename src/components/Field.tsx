import { useLayoutEffect, useRef, type ChangeEvent, type ReactNode } from 'react'
import { groupDigits } from '../lib/format'

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  /** Show thousands separators as the user types (dollar amounts, sq ft). */
  grouped?: boolean
  /** Span both columns of the field grid. */
  wide?: boolean
  /** Helper text under the input, announced as the input's description. */
  hint?: ReactNode
  /** Extra controls under the input (e.g. quick-pick buttons). */
  children?: ReactNode
}

const SIGNIFICANT = /[\d.-]/

/** Caret index in `text` just after the `count`-th significant character. */
function caretAfter(text: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (SIGNIFICANT.test(text[i]) && ++seen === count) return i + 1
  }
  return text.length
}

export function Field({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  grouped = false,
  wide = false,
  hint,
  children,
}: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const display = grouped ? groupDigits(value) : value

  // Re-inserting commas moves the caret to the end; put it back after the
  // same digit the user was editing.
  useLayoutEffect(() => {
    const input = inputRef.current
    const caret = pendingCaret.current
    pendingCaret.current = null
    if (input && caret != null && document.activeElement === input) {
      input.setSelectionRange(caret, caret)
    }
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (!grouped) {
      onChange(raw)
      return
    }
    const caret = e.target.selectionStart ?? raw.length
    const before = raw.slice(0, caret).split('').filter((c) => SIGNIFICANT.test(c)).length
    const next = groupDigits(raw)
    pendingCaret.current = caretAfter(next, before)
    onChange(next)
  }

  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className={`field ${wide ? 'field-wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        {prefix ? <span className="field-affix">{prefix}</span> : null}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          aria-describedby={hintId}
          onChange={handleChange}
        />
        {suffix ? <span className="field-affix">{suffix}</span> : null}
      </div>
      {hint ? (
        <div id={hintId} className="field-hint">
          {hint}
        </div>
      ) : null}
      {children}
    </div>
  )
}

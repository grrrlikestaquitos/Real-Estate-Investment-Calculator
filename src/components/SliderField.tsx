import type { CSSProperties, ReactNode } from 'react'
import { parseInput } from '../lib/calculations'

interface SliderFieldProps {
  id: string
  label: string
  /** Text in the number box; the slider follows it. */
  value: string
  onChange: (value: string) => void
  min: number
  max: number
  step: number
  suffix?: string
  placeholder?: string
  /** Where the slider rests while the box is empty (shown hollow). Defaults to the placeholder's number, else mid-range. */
  restingValue?: number
  /** Live readout under the label, e.g. what the percentage is in dollars. */
  hint?: ReactNode
  disabled?: boolean
  onFocus?: () => void
  onBlur?: () => void
  /** Extra controls under the slider (e.g. quick-pick buttons). */
  children?: ReactNode
  /** A "?" tip explaining the label. */
  info?: ReactNode
}

/** The number in a placeholder like "e.g. 8" or "Auto 0.5". */
function numberIn(text: string | undefined): number | null {
  const match = text?.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

function decimalsOf(step: number): number {
  return (String(step).split('.')[1] ?? '').length
}

/**
 * A percentage-style input as a number box plus a slider across a typical range.
 * The box takes any value; the slider is for quick, keyboard-free adjustment.
 */
export function SliderField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  placeholder,
  restingValue,
  hint,
  disabled = false,
  onFocus,
  onBlur,
  children,
  info,
}: SliderFieldProps) {
  const parsed = parseInput(value)
  const empty = parsed == null
  const position = Math.min(max, Math.max(min, parsed ?? restingValue ?? numberIn(placeholder) ?? (min + max) / 2))
  const fill = empty ? 0 : ((position - min) / (max - min)) * 100
  const hintId = hint ? `${id}-hint` : undefined
  const decimals = decimalsOf(step)
  const commit = (n: number) => onChange(String(Number(n.toFixed(decimals))))

  return (
    <div className="field field-wide slider-field">
      <div className="slider-field-head">
        <div className="slider-field-text">
          <div className="field-label-row">
            <label htmlFor={id}>{label}</label>
            {info}
          </div>
          {hint ? (
            <div id={hintId} className="field-hint">
              {hint}
            </div>
          ) : null}
        </div>
        <div className="field-input field-input-compact">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            aria-describedby={hintId}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          {suffix ? <span className="field-affix">{suffix}</span> : null}
        </div>
      </div>
      <input
        type="range"
        className={`range ${empty ? 'range-empty' : ''}`}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        aria-label={`Adjust ${label.toLowerCase()}`}
        aria-valuetext={empty ? 'Not set' : `${parsed}${suffix ?? ''}`}
        min={min}
        max={max}
        step={step}
        value={position}
        disabled={disabled}
        onChange={(e) => commit(Number(e.target.value))}
        // A tap on the resting thumb of an empty field doesn't fire a change; take it as a pick.
        onPointerUp={() => {
          if (empty && !disabled) commit(position)
        }}
      />
      {children}
    </div>
  )
}

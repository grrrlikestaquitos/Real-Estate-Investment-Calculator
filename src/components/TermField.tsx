import { useRef, useState } from 'react'
import { parseInput } from '../lib/calculations'
import { SegmentedControl } from './SegmentedControl'

interface TermFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Common terms, in years, offered as one-tap choices. */
  presets: readonly number[]
  /** The term an empty value stands for (e.g. a 30-year default), shown as selected. */
  emptyMeans?: number
}

const OTHER = 'other'

/** Loan term as one-tap common choices, with "Other" for any number of years. */
export function TermField({ id, label, value, onChange, presets, emptyMeans }: TermFieldProps) {
  const [custom, setCustom] = useState(false)
  const focusInput = useRef(false)
  const years = parseInput(value) ?? emptyMeans ?? null
  const preset = !custom && years != null && presets.includes(years) ? years : null
  const labelId = `${id}-label`

  function choose(option: string) {
    if (option === OTHER) {
      focusInput.current = true
      setCustom(true)
      return
    }
    setCustom(false)
    onChange(option)
  }

  return (
    <div className="field field-wide term-field">
      <div className="term-field-head">
        <span id={labelId} className="field-label">
          {label}
        </span>
        <SegmentedControl
          label={label}
          value={preset == null ? OTHER : String(preset)}
          options={[
            ...presets.map((p) => ({ value: String(p), label: `${p} yr` })),
            { value: OTHER, label: 'Other' },
          ]}
          onChange={choose}
        />
      </div>
      {preset == null ? (
        <div className="field-input field-input-compact term-field-input">
          <input
            ref={(el) => {
              if (el && focusInput.current) {
                focusInput.current = false
                el.focus()
                el.select()
              }
            }}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder={emptyMeans != null ? String(emptyMeans) : undefined}
            aria-labelledby={labelId}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="field-affix">yrs</span>
        </div>
      ) : null}
    </div>
  )
}

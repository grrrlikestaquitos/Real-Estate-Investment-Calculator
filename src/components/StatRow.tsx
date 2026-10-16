import type { ReactNode } from 'react'

interface StatRowProps {
  label: string
  value: string
  tone?: 'positive' | 'negative'
  /** A "?" tip explaining the label. */
  info?: ReactNode
}

export function StatRow({ label, value, tone, info }: StatRowProps) {
  return (
    <div className={`stat-row ${tone ? `stat-row-${tone}` : ''}`}>
      <span className="stat-label">
        {label}
        {info}
      </span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

interface StatRowProps {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}

export function StatRow({ label, value, tone }: StatRowProps) {
  return (
    <div className={`stat-row ${tone ? `stat-row-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

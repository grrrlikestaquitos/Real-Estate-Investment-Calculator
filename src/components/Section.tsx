import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Render without card chrome (h3 header), for use inside a disclosure. */
  plain?: boolean
  /** Span the full width of the results grid. */
  wide?: boolean
  /** Keep on the one-page printout (other results sections are left off paper). */
  printKeep?: boolean
}

export function Section({
  title,
  subtitle,
  children,
  plain = false,
  wide = false,
  printKeep = false,
}: SectionProps) {
  if (plain) {
    return (
      <section className={`section-plain ${wide ? 'span-2' : ''}`}>
        <h3>{title}</h3>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
        {children}
      </section>
    )
  }

  return (
    <section className={`card ${wide ? 'span-2' : ''} ${printKeep ? 'print-keep' : ''}`}>
      <header className="card-header">
        <h2>{title}</h2>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

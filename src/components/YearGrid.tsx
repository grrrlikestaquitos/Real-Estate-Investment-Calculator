interface YearGridColumn {
  label: string
  values: readonly (number | null)[]
}

interface YearGridProps {
  years: readonly number[]
  columns: readonly YearGridColumn[]
  format: (value: number | null) => string
}

/** One row per horizon, one column per projected series. */
export function YearGrid({ years, columns, format }: YearGridProps) {
  return (
    <div className="table-scroll">
      <table className="year-grid">
        <thead>
          <tr>
            <th scope="col">Horizon</th>
            {columns.map((column, c) => (
              <th key={c} scope="col" className="numeric">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y, i) => (
            <tr key={y}>
              <th scope="row">{`${y} Year${y === 1 ? '' : 's'}`}</th>
              {columns.map((column, c) => {
                const value = column.values[i]
                return (
                  <td
                    key={c}
                    className={`numeric ${value != null && value < 0 ? 'negative' : ''}`}
                  >
                    {format(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Deal, DealType } from '../lib/types'
import { SegmentedControl } from './SegmentedControl'

interface DealHeaderProps {
  deal: Deal
  canDelete: boolean
  /** Focus and select the name so a new deal can be named right away. */
  autoFocusName?: boolean
  onRename: (name: string) => void
  onTypeChange: (type: DealType) => void
  onDuplicate: () => void
  onShare: () => void
  onDelete: () => void
}

export function DealHeader({
  deal,
  canDelete,
  autoFocusName = false,
  onRename,
  onTypeChange,
  onDuplicate,
  onShare,
  onDelete,
}: DealHeaderProps) {
  const [draft, setDraft] = useState(deal.name)
  const [syncedName, setSyncedName] = useState(deal.name)
  const nameRef = useRef<HTMLInputElement>(null)

  // Pick up renames that happen elsewhere (e.g. importing a backup).
  if (deal.name !== syncedName) {
    setSyncedName(deal.name)
    setDraft(deal.name)
  }

  useEffect(() => {
    if (autoFocusName) {
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [autoFocusName])

  function commit() {
    const name = draft.trim()
    if (name === '') {
      setDraft(deal.name)
      return
    }
    if (name !== deal.name) onRename(name)
  }

  return (
    <div className="deal-header">
      <div className="deal-title">
        <input
          ref={nameRef}
          className="deal-name-input"
          aria-label="Deal name"
          title="Click to rename"
          value={draft}
          maxLength={80}
          size={Math.max(8, Math.min(draft.length + 1, 36))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setDraft(deal.name)
          }}
        />
        <SegmentedControl
          label="Deal type"
          value={deal.type}
          options={[
            { value: 'investment', label: 'Investor (Rental)' },
            { value: 'owner', label: 'Homeowner' },
          ]}
          onChange={onTypeChange}
        />
      </div>
      <div className="deal-actions">
        <button type="button" className="btn btn-small" onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className="btn btn-small" onClick={onShare}>
          Copy link
        </button>
        {canDelete ? (
          <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

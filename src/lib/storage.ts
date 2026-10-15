import type { Deal, DealInputs, DealType } from './types'
import { DEFAULT_DEAL_TYPE, DEFAULT_INPUTS } from './types'

const STORAGE_KEY = 'brrr-calculator/deals/v1'
const HASH_PREFIX = '#d='

const INPUT_KEYS = Object.keys(DEFAULT_INPUTS) as (keyof DealInputs)[]

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function sanitizeInputs(raw: unknown): DealInputs {
  const source = (raw ?? {}) as Record<string, unknown>
  const inputs = {} as DealInputs
  for (const key of INPUT_KEYS) {
    inputs[key] = toFiniteNumber(source[key])
  }
  return inputs
}

export function sanitizeDeal(raw: unknown): Deal | null {
  if (raw == null || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  if (typeof source.id !== 'string' || source.id === '') return null
  return {
    id: source.id,
    name: typeof source.name === 'string' && source.name !== '' ? source.name : 'Untitled Deal',
    type: source.type === 'owner' ? 'owner' : DEFAULT_DEAL_TYPE,
    inputs: sanitizeInputs(source.inputs),
    createdAt: toFiniteNumber(source.createdAt) ?? Date.now(),
    updatedAt: toFiniteNumber(source.updatedAt) ?? Date.now(),
  }
}

export function loadDeals(): Deal[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeDeal).filter((d): d is Deal => d != null)
  } catch {
    return []
  }
}

let lastSaveOk = true
const saveStatusListeners = new Set<() => void>()

/** Persist deals; returns false when storage is unavailable (the app still works in-memory). */
export function saveDeals(deals: Deal[]): boolean {
  let ok: boolean
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
    ok = true
  } catch {
    ok = false
  }
  if (ok !== lastSaveOk) {
    lastSaveOk = ok
    saveStatusListeners.forEach((notify) => notify())
  }
  return ok
}

/** Whether the most recent save succeeded (for useSyncExternalStore). */
export function getSaveStatus(): boolean {
  return lastSaveOk
}

export function subscribeSaveStatus(onChange: () => void): () => void {
  saveStatusListeners.add(onChange)
  return () => {
    saveStatusListeners.delete(onChange)
  }
}

// ---------------------------------------------------------------------------
// Backup files (export / import)
// ---------------------------------------------------------------------------

const BACKUP_APP = 'brrr-calculator'
const BACKUP_VERSION = 1

/** Serialize deals into a JSON backup file body. */
export function exportDealsJson(deals: Deal[], exportedAt = new Date()): string {
  return JSON.stringify(
    { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), deals },
    null,
    2,
  )
}

/**
 * Parse a backup file body. Accepts the exported `{ deals: [...] }` shape or
 * a bare array of deals. Returns null when nothing usable is found.
 */
export function parseImportedDeals(json: string): Deal[] | null {
  try {
    const parsed: unknown = JSON.parse(json)
    const list = Array.isArray(parsed)
      ? parsed
      : parsed != null && typeof parsed === 'object'
        ? (parsed as { deals?: unknown }).deals
        : null
    if (!Array.isArray(list)) return null
    const deals = list.map(sanitizeDeal).filter((d): d is Deal => d != null)
    return deals.length > 0 ? deals : null
  } catch {
    return null
  }
}

/**
 * Merge imported deals into the current list: a deal with a matching id is
 * replaced in place (restoring a backup), and new deals are appended.
 */
export function mergeDeals(current: Deal[], incoming: Deal[]): Deal[] {
  const byId = new Map(incoming.map((d) => [d.id, d]))
  const merged = current.map((d) => byId.get(d.id) ?? d)
  const existing = new Set(current.map((d) => d.id))
  return [...merged, ...incoming.filter((d) => !existing.has(d.id))]
}

const COMPARE_HIDDEN_KEY = 'brrr-calculator/compare-hidden/v1'

/** Ids of deals the user left out of the comparison view. */
export function loadHiddenFromCompare(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COMPARE_HIDDEN_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveHiddenFromCompare(ids: string[]): void {
  try {
    window.localStorage.setItem(COMPARE_HIDDEN_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable: the selection lasts for this visit only.
  }
}

export function newDealId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `deal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------------------------------------------------------------------------
// Shareable links
// ---------------------------------------------------------------------------

interface SharePayload {
  id: string
  name: string
  type: DealType
  inputs: DealInputs
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Build an absolute URL that opens this deal's inputs in a fresh browser. */
export function shareUrlFor(deal: Deal): string {
  const payload: SharePayload = { id: deal.id, name: deal.name, type: deal.type, inputs: deal.inputs }
  const encoded = toBase64Url(JSON.stringify(payload))
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : ''
  return `${base}${HASH_PREFIX}${encoded}`
}

/** Parse a window.location.hash into a shareable deal, if present. */
export function parseHashForDeal(hash: string): Deal | null {
  if (!hash.startsWith(HASH_PREFIX)) return null
  try {
    const json = fromBase64Url(hash.slice(HASH_PREFIX.length))
    const payload = JSON.parse(json) as SharePayload
    const deal = sanitizeDeal({
      id: payload.id,
      name: payload.name,
      type: payload.type,
      inputs: payload.inputs,
    })
    return deal
  } catch {
    return null
  }
}

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Deal, DealInputs, DealType } from '../lib/types'
import { DEFAULT_DEAL_TYPE, DEFAULT_INPUTS } from '../lib/types'
import {
  getSaveStatus,
  loadDeals,
  mergeDeals,
  newDealId,
  parseHashForDeal,
  saveDeals,
  shareUrlFor,
  subscribeSaveStatus,
} from '../lib/storage'

interface InitialState {
  deals: Deal[]
  activeId: string
}

function createDeal(
  name: string,
  type: DealType = DEFAULT_DEAL_TYPE,
  inputs: DealInputs = { ...DEFAULT_INPUTS },
): Deal {
  const now = Date.now()
  return {
    id: newDealId(),
    name,
    type,
    inputs: { ...inputs },
    createdAt: now,
    updatedAt: now,
  }
}

function initFromStorage(): InitialState {
  let deals = loadDeals()
  const fromHash = parseHashForDeal(window.location.hash)

  if (fromHash) {
    const existing = deals.find((d) => d.id === fromHash.id)
    if (existing) {
      return { deals, activeId: fromHash.id }
    }
    deals = [{ ...fromHash, createdAt: Date.now(), updatedAt: Date.now() }, ...deals]
    return { deals, activeId: fromHash.id }
  }

  if (deals.length === 0) {
    deals = [createDeal('My Deal')]
  }
  return { deals, activeId: deals[0].id }
}

export function useDeals() {
  const [initial] = useState(initFromStorage)
  const [deals, setDeals] = useState<Deal[]>(initial.deals)
  const [activeId, setActiveId] = useState(initial.activeId)
  const storageOk = useSyncExternalStore(subscribeSaveStatus, getSaveStatus)

  useEffect(() => {
    saveDeals(deals)
  }, [deals])

  const activeDeal = useMemo(
    () => deals.find((d) => d.id === activeId) ?? deals[0],
    [deals, activeId],
  )

  function createDealAction(name?: string, type: DealType = DEFAULT_DEAL_TYPE) {
    const deal = createDeal(name?.trim() || `Deal ${deals.length + 1}`, type)
    setDeals((prev) => [...prev, deal])
    setActiveId(deal.id)
    return deal.id
  }

  function setDealType(id: string, type: DealType) {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, type, updatedAt: Date.now() } : d)),
    )
  }

  function renameDeal(id: string, name: string) {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, name: name.trim() || d.name, updatedAt: Date.now() } : d,
      ),
    )
  }

  /** Copy a deal (inputs and mode) right after the original and switch to the copy. */
  function duplicateDeal(id: string) {
    const index = deals.findIndex((d) => d.id === id)
    if (index === -1) return
    const source = deals[index]
    const copy = createDeal(`${source.name} (copy)`, source.type, source.inputs)
    setDeals((prev) => {
      const at = prev.findIndex((d) => d.id === id)
      return at === -1 ? [copy, ...prev] : [...prev.slice(0, at + 1), copy, ...prev.slice(at + 1)]
    })
    setActiveId(copy.id)
  }

  function deleteDeal(id: string) {
    const index = deals.findIndex((d) => d.id === id)
    if (index === -1) return
    const remaining = deals.filter((d) => d.id !== id)
    if (remaining.length === 0) {
      const fresh = createDeal('My Deal')
      setDeals([fresh])
      setActiveId(fresh.id)
      return
    }
    setDeals(remaining)
    if (id === activeDeal.id) {
      setActiveId(remaining[Math.max(0, index - 1)].id)
    }
  }

  /** Put a deleted deal back at its old position and switch to it (undo). */
  function restoreDeal(deal: Deal, index: number) {
    setDeals((prev) => {
      const without = prev.filter((d) => d.id !== deal.id)
      return [...without.slice(0, index), deal, ...without.slice(index)]
    })
    setActiveId(deal.id)
  }

  /** Merge deals from a backup file and switch to the first imported deal. */
  function importDeals(incoming: Deal[]) {
    if (incoming.length === 0) return
    setDeals((prev) => mergeDeals(prev, incoming))
    setActiveId(incoming[0].id)
  }

  function setInputs(id: string, inputs: DealInputs) {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, inputs, updatedAt: Date.now() } : d)),
    )
  }

  function resetInputs(id: string) {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, inputs: { ...DEFAULT_INPUTS }, updatedAt: Date.now() } : d,
      ),
    )
  }

  return {
    deals,
    activeDeal,
    activeId: activeDeal.id,
    setActiveId,
    createDeal: createDealAction,
    duplicateDeal,
    setDealType,
    renameDeal,
    deleteDeal,
    restoreDeal,
    importDeals,
    setInputs,
    resetInputs,
    shareUrl: (deal: Deal) => shareUrlFor(deal),
    /** False when the last save to localStorage failed (private mode, quota). */
    storageOk,
  }
}

export type DealsApi = ReturnType<typeof useDeals>

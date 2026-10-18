import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { formatCurrency, formatNumber } from '../lib/format'
import type { ListingAnalysis } from '../lib/screening'
import zipShapes from '../lib/zipShapes.json'

export interface ZipSummary {
  zip: string
  count: number
  cities: string[]
  area: string
}

interface ListingsMapProps {
  /** Every ZIP in the data, whether or not anything in it matches the filters. */
  zips: ZipSummary[]
  /** The listings that match the filters: drawn as dots. */
  results: ListingAnalysis[]
  hiddenZips: string[]
  onToggleZip: (zip: string) => void
  onSelectListing: (id: string) => void
}

type ZipFeature = Feature<Geometry, { zip: string }>
const SHAPES = zipShapes as unknown as FeatureCollection<Geometry, { zip: string }>

/** OpenStreetMap's standard tiles (dark mode dims them with a CSS filter, see index.css). */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ZIP areas: U.S. Census Bureau'

/** ZIP numbers are drawn on the map from this zoom in (they crowd it further out). */
const LABEL_ZOOM = 11

/** The page's own color tokens, so the map matches the theme. */
function tokens() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    accent: get('--accent', '#4da3ff'),
    positive: get('--positive', '#4cc38a'),
    faint: get('--text-faint', '#7a8295'),
    surface: get('--bg-card', '#313644'),
  }
}

function scoreColor(score: number, t: ReturnType<typeof tokens>): string {
  if (score >= 70) return t.positive
  if (score >= 50) return t.accent
  return t.faint
}

/** ZIPs, cities and areas come from the data: escape them for tooltip HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Popup content built from DOM nodes: listing text is data, never markup. */
function popupContent(a: ListingAnalysis, onSelect: (id: string) => void): HTMLElement {
  const l = a.listing
  const root = document.createElement('div')
  root.className = 'listings-map-popup'
  const title = document.createElement('strong')
  title.textContent = `${formatCurrency(l.price)} · score ${a.score}`
  const address = document.createElement('div')
  address.textContent = `${l.address}, ${l.city} ${l.zip}`
  const facts = document.createElement('div')
  facts.className = 'listings-map-popup-facts'
  facts.textContent = [
    l.beds != null ? `${l.beds}${l.bedsAtLeast ? '+' : ''} bd` : null,
    l.sqft != null ? `${formatNumber(l.sqft)} sqft` : null,
    l.yearBuilt != null ? `built ${l.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-small'
  button.textContent = 'Go to listing'
  button.addEventListener('click', () => onSelect(l.id))
  root.append(title, address, facts, button)
  return root
}

/**
 * Leaflet map of the listings: ZIP areas that have listings (click one to hide
 * or show it) and a dot per matching listing, colored like its score badge.
 */
export default function ListingsMap({
  zips,
  results,
  hiddenZips,
  onToggleZip,
  onSelectListing,
}: ListingsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const zipLayerRef = useRef<L.GeoJSON | null>(null)
  const dotLayerRef = useRef<L.LayerGroup | null>(null)
  const fittedRef = useRef(false)
  // Leaflet handlers are bound once; read the latest props through refs.
  const toggleRef = useRef(onToggleZip)
  const selectRef = useRef(onSelectListing)
  useEffect(() => {
    toggleRef.current = onToggleZip
    selectRef.current = onSelectListing
  })

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = L.map(container, { scrollWheelZoom: false, zoomSnap: 0.5 })
    map.createPane('dots').style.zIndex = '450'
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)
    const updateLabels = () => container.classList.toggle('listings-map-labels', map.getZoom() >= LABEL_ZOOM)
    map.on('zoomend', updateLabels)
    map.setView([47.75, -122.2], 9)
    updateLabels()
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      zipLayerRef.current = null
      dotLayerRef.current = null
      fittedRef.current = false
    }
  }, [])

  // ZIP areas: redrawn when the ZIPs, what's hidden, or the matches change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = tokens()
    const byZip = new Map(zips.map((z) => [z.zip, z]))
    const matching = new Map<string, number>()
    for (const r of results) matching.set(r.listing.zip, (matching.get(r.listing.zip) ?? 0) + 1)
    const hidden = new Set(hiddenZips)

    zipLayerRef.current?.remove()
    const shapes: FeatureCollection<Geometry, { zip: string }> = {
      ...SHAPES,
      features: SHAPES.features.filter((f) => byZip.has(f.properties.zip)),
    }
    const layer = L.geoJSON(shapes, {
      style: (feature) => {
        const isHidden = hidden.has((feature as ZipFeature).properties.zip)
        return isHidden
          ? { color: t.faint, weight: 1, dashArray: '4 3', fillColor: t.faint, fillOpacity: 0.4 }
          : { color: t.accent, weight: 1, opacity: 0.7, fillColor: t.accent, fillOpacity: 0.06 }
      },
      onEachFeature: (feature, path) => {
        const zip = (feature as ZipFeature).properties.zip
        const info = byZip.get(zip)!
        const status = hidden.has(zip)
          ? `${info.count} listings · hidden — click to show`
          : `${info.count} listings, ${matching.get(zip) ?? 0} match · click to hide`
        const lines = [
          `<strong>${escapeHtml(zip)}</strong> · ${escapeHtml(info.cities.join(', '))}`,
          escapeHtml(info.area),
          status,
        ]
        path.bindTooltip(lines.filter(Boolean).join('<br>'), {
          sticky: true,
          className: 'listings-map-tip',
        })
        path.on({
          click: () => toggleRef.current(zip),
          mouseover: () => (path as L.Path).setStyle({ weight: 2.5 }),
          mouseout: () => (path as L.Path).setStyle({ weight: 1 }),
        })
      },
    })
    layer.addTo(map)
    zipLayerRef.current = layer

    const labels = L.layerGroup(
      layer.getLayers().map((path) => {
        const poly = path as L.Polygon
        const zip = (poly.feature as ZipFeature).properties.zip
        return L.marker(poly.getBounds().getCenter(), {
          interactive: false,
          icon: L.divIcon({
            className: `listings-map-zip ${hidden.has(zip) ? 'listings-map-zip-hidden' : ''}`,
            html: escapeHtml(zip),
            iconSize: [44, 16],
          }),
        })
      }),
    ).addTo(map)

    if (!fittedRef.current && layer.getLayers().length > 0) {
      map.fitBounds(layer.getBounds(), { padding: [8, 8] })
      fittedRef.current = true
    }
    return () => {
      labels.remove()
    }
  }, [zips, hiddenZips, results])

  // Listing dots.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = tokens()
    dotLayerRef.current?.remove()
    const dots = L.layerGroup(
      results
        .filter((r) => r.listing.lat != null && r.listing.lng != null)
        // Best last, so they draw on top.
        .sort((a, b) => a.score - b.score)
        .map((r) =>
          L.circleMarker([r.listing.lat!, r.listing.lng!], {
            pane: 'dots',
            radius: 5,
            weight: 1.5,
            color: t.surface,
            fillColor: scoreColor(r.score, t),
            fillOpacity: 1,
          }).bindPopup(() => popupContent(r, (id) => selectRef.current(id)), {
            closeButton: true,
          }),
        ),
    ).addTo(map)
    dotLayerRef.current = dots
  }, [results])

  return (
    <div
      ref={containerRef}
      className="listings-map"
      role="region"
      aria-label="Map of listings and ZIP codes"
    />
  )
}

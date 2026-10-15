const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10]

/**
 * Evenly spaced, human-friendly axis ticks (steps of 1, 2, 2.5 or 5 × 10^n)
 * covering [min, max]. Picks the step whose interval count is closest to
 * `target`, preferring the tighter fit on ties.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  let lo = Math.min(min, max)
  let hi = Math.max(min, max)
  if (hi - lo < 1e-9) {
    const pad = Math.abs(lo) || 1
    lo -= lo === 0 ? 0 : pad
    hi += pad
  }
  const magnitude = 10 ** Math.floor(Math.log10((hi - lo) / target))

  let best = { step: magnitude, first: 0, last: 0, score: Infinity }
  for (const multiplier of STEP_MULTIPLIERS) {
    const step = multiplier * magnitude
    const first = Math.floor(lo / step)
    const last = Math.ceil(hi / step)
    const span = (last - first) * step
    // Interval-count distance first; overshoot of the range breaks ties.
    const score = Math.abs(last - first - target) + span / (hi - lo) / 1000
    if (score < best.score) best = { step, first, last, score }
  }

  const ticks: number[] = []
  for (let i = best.first; i <= best.last; i++) ticks.push(i * best.step)
  return ticks
}

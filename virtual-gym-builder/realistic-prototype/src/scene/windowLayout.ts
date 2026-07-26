export interface WindowPlacement {
  center: number
  width: number
}

export interface ReservedSpan {
  center: number
  radius: number
}

const CORNER_CLEARANCE = 0.65
const MIN_WINDOW_WIDTH = 2.2
const MAX_WINDOW_WIDTH = 3.6
const WINDOW_GAP = 0.72
const MAX_WINDOWS_PER_WALL = 5

export function normalizeWallPosition(center: number, wallLength: number): number {
  return Number((center / (wallLength / 2)).toFixed(6))
}

export function restoreWallPosition(normalizedPosition: number | undefined, fallback: number, wallLength: number): number {
  return normalizedPosition === undefined ? fallback : normalizedPosition * wallLength / 2
}

export function constrainWallPosition(
  center: number,
  elementWidth: number,
  wallLength: number,
  reserved: ReservedSpan[],
  snap: number | null,
): number {
  const halfWidth = elementWidth / 2
  const minimum = -wallLength / 2 + CORNER_CLEARANCE + halfWidth
  const maximum = wallLength / 2 - CORNER_CLEARANCE - halfWidth
  const candidate = Math.max(minimum, Math.min(maximum, snap ? Math.round(center / snap) * snap : center))
  const available = [{ start: minimum, end: maximum }]

  for (const span of reserved) {
    const blockedStart = span.center - span.radius - halfWidth
    const blockedEnd = span.center + span.radius + halfWidth
    for (let index = available.length - 1; index >= 0; index -= 1) {
      const interval = available[index]
      if (blockedEnd <= interval.start || blockedStart >= interval.end) continue
      available.splice(index, 1)
      if (blockedStart > interval.start) available.push({ start: interval.start, end: Math.min(blockedStart, interval.end) })
      if (blockedEnd < interval.end) available.push({ start: Math.max(blockedEnd, interval.start), end: interval.end })
    }
  }

  if (available.length === 0) return Number(candidate.toFixed(6))
  return Number(available
    .flatMap((interval) => [Math.max(interval.start, Math.min(interval.end, candidate))])
    .sort((left, right) => Math.abs(left - candidate) - Math.abs(right - candidate))[0].toFixed(6))
}

export function distributeWallWindows(wallLength: number, reserved: ReservedSpan[]): WindowPlacement[] {
  const wallStart = -wallLength / 2 + CORNER_CLEARANCE
  const wallEnd = wallLength / 2 - CORNER_CLEARANCE
  const blocked = reserved
    .map(({ center, radius }) => ({ start: Math.max(wallStart, center - radius), end: Math.min(wallEnd, center + radius) }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start)

  const segments: Array<{ start: number; end: number }> = []
  let cursor = wallStart
  for (const span of blocked) {
    if (span.start - cursor >= MIN_WINDOW_WIDTH) segments.push({ start: cursor, end: span.start })
    cursor = Math.max(cursor, span.end)
  }
  if (wallEnd - cursor >= MIN_WINDOW_WIDTH) segments.push({ start: cursor, end: wallEnd })

  const candidates = segments.flatMap(({ start, end }) => {
    const length = end - start
    const count = Math.max(1, Math.floor((length + WINDOW_GAP) / (MAX_WINDOW_WIDTH + WINDOW_GAP)))
    const width = Math.min(MAX_WINDOW_WIDTH, (length - WINDOW_GAP * (count - 1)) / count)
    if (width < MIN_WINDOW_WIDTH) return []
    const occupiedWidth = count * width + (count - 1) * WINDOW_GAP
    const firstCenter = start + (length - occupiedWidth) / 2 + width / 2
    return Array.from({ length: count }, (_, index) => ({ center: firstCenter + index * (width + WINDOW_GAP), width }))
  })

  if (candidates.length <= MAX_WINDOWS_PER_WALL) return candidates
  return Array.from({ length: MAX_WINDOWS_PER_WALL }, (_, index) => (
    candidates[Math.round(index * (candidates.length - 1) / (MAX_WINDOWS_PER_WALL - 1))]
  ))
}
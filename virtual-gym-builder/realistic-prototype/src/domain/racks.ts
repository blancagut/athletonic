import { EQUIPMENT } from '../catalog/equipment'
import type { EquipmentKind, PlacedEquipment, RackConfiguration, RackLayout, RackMountType, RackStation } from './types'

export const RACK_KINDS = ['bag-rack-1', 'bag-rack-2', 'bag-rack-3', 'bag-rack-4', 'speed-bag-platform', 'double-end-system'] as const
export type RackKind = typeof RACK_KINDS[number]

export const HEAVY_BAG_KINDS: EquipmentKind[] = [
  'heavy-bag', 'banana-bag', 'banana-bag-xl', 'teardrop-bag', 'hb2-classic', 'hb3-extra-large',
  'hb5-4ft', 'hb6-6ft-banana', 'hb10-bowling', 'hb11-uppercut', 'hb12-angle',
  'hb13-super-angle', 'hb15-super-teardrop', 'hb16-water',
]
export const SPEED_BAG_KINDS: EquipmentKind[] = [
  'speed-bag-18x13', 'speed-bag-20x15', 'speed-bag-23x18', 'speed-bag-25x20', 'speed-bag-28x22',
]
export const DOUBLE_END_KINDS: EquipmentKind[] = ['double-end-25x18', 'double-end-30x20', 'double-end-35x22']

const LAYOUT_BY_KIND: Record<RackKind, RackLayout> = {
  'bag-rack-1': 'single',
  'bag-rack-2': 'linear',
  'bag-rack-3': 'radial',
  'bag-rack-4': 'square-4',
  'speed-bag-platform': 'speed-platform',
  'double-end-system': 'double-end',
}

export function isRackKind(kind: EquipmentKind): kind is RackKind {
  return RACK_KINDS.includes(kind as RackKind)
}

function station(id: string, localPosition: [number, number, number], localRotation: number, mountType: RackMountType, maxLoadKg?: number): RackStation {
  return { id, localPosition, localRotation, mountType, mountedEquipmentId: null, maxLoadKg }
}

export function createRackConfiguration(kind: RackKind, requestedCount?: number): RackConfiguration {
  const layout = LAYOUT_BY_KIND[kind]
  if (layout === 'linear') {
    const stationCount = Math.max(1, Math.floor(requestedCount ?? 2))
    const spacing = 2.2
    return {
      layout,
      stationCount,
      stationSpacingMeters: spacing,
      stations: Array.from({ length: stationCount }, (_, index) => station(
        `station-${index + 1}`,
        [(index - (stationCount - 1) / 2) * spacing, 2.44, 0],
        0,
        'heavy-bag-hook',
      )),
    }
  }
  if (layout === 'radial') {
    const stationCount = Math.min(4, Math.max(3, Math.floor(requestedCount ?? 3)))
    const angles = stationCount === 3 ? [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6] : [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
    return {
      layout,
      stationCount,
      stations: angles.map((angle, index) => station(
        `station-${index + 1}`,
        [Math.cos(angle) * 1.4, 2.44, Math.sin(angle) * 1.4],
        -angle,
        'heavy-bag-hook',
      )),
    }
  }
  if (layout === 'square-4') {
    return {
      layout,
      stationCount: 4,
      stations: [
        station('station-1', [0, 2.44, -0.915], 0, 'heavy-bag-hook', 136),
        station('station-2', [0.915, 2.44, 0], -Math.PI / 2, 'heavy-bag-hook', 136),
        station('station-3', [0, 2.44, 0.915], Math.PI, 'heavy-bag-hook', 136),
        station('station-4', [-0.915, 2.44, 0], Math.PI / 2, 'heavy-bag-hook', 136),
      ],
    }
  }
  if (layout === 'speed-platform') {
    return { layout, stationCount: 1, stations: [station('station-1', [0, 2.02, 0], 0, 'speed-bag-swivel')] }
  }
  if (layout === 'double-end') {
    return {
      layout,
      stationCount: 2,
      ceilingHeightMeters: 3,
      tension: 0.55,
      stations: [
        station('station-top', [0, 3, 0], 0, 'double-end-top'),
        station('station-bottom', [0, 0.05, 0], 0, 'double-end-bottom'),
      ],
    }
  }
  return { layout, stationCount: 1, stations: [station('station-1', [0, 2.4, 0], 0, 'heavy-bag-hook', 68)] }
}

export function ensureRackConfiguration(item: PlacedEquipment): RackConfiguration | undefined {
  if (!isRackKind(item.kind)) return undefined
  return item.rack ?? createRackConfiguration(item.kind)
}

export function compatibleEquipment(mountType: RackMountType): EquipmentKind[] {
  if (mountType === 'heavy-bag-hook') return HEAVY_BAG_KINDS
  if (mountType === 'speed-bag-swivel') return SPEED_BAG_KINDS
  return DOUBLE_END_KINDS
}

export function compatibilityError(mountType: RackMountType, kind: EquipmentKind): string | null {
  if (compatibleEquipment(mountType).includes(kind)) return null
  if (mountType === 'speed-bag-swivel') return 'This swivel accepts compatible speed bags only.'
  if (mountType.startsWith('double-end')) return 'Double-end anchors require a compatible double-end bag.'
  return 'This hook accepts approved hanging bags only.'
}

export function rackDimensions(rack: RackConfiguration): [number, number, number] {
  if (rack.layout === 'linear') return [Math.max(1.8, (rack.stationCount - 1) * (rack.stationSpacingMeters ?? 2.2) + 1.2), 1.45, 2.48]
  if (rack.layout === 'radial') return [3, 3, 2.48]
  if (rack.layout === 'square-4') return [1.83, 1.83, 2.48]
  if (rack.layout === 'speed-platform') return [0.82, 1.15, 2.35]
  if (rack.layout === 'double-end') return [0.32, 0.32, rack.ceilingHeightMeters ?? 3]
  return [1.78, 1.55, 2.44]
}

export interface RackWarning {
  stationIds: string[]
  message: string
}

export function rackWarnings(rackItem: PlacedEquipment, equipment: PlacedEquipment[], room: { width: number; depth: number }): RackWarning[] {
  const rack = ensureRackConfiguration(rackItem)
  if (!rack) return []
  const warnings: RackWarning[] = []
  const [width, depth] = rackDimensions(rack)
  const rotatedWidth = Math.abs(Math.cos(rackItem.rotation)) * width + Math.abs(Math.sin(rackItem.rotation)) * depth
  const rotatedDepth = Math.abs(Math.sin(rackItem.rotation)) * width + Math.abs(Math.cos(rackItem.rotation)) * depth
  if (Math.abs(rackItem.x) + rotatedWidth / 2 > room.width / 2 || Math.abs(rackItem.z) + rotatedDepth / 2 > room.depth / 2) {
    warnings.push({ stationIds: [], message: 'Rack footprint extends outside the room.' })
  }
  if (rack.layout === 'linear') {
    for (let index = 0; index < rack.stations.length - 1; index += 1) {
      const left = rack.stations[index]
      const right = rack.stations[index + 1]
      const leftItem = equipment.find((item) => item.id === left.mountedEquipmentId)
      const rightItem = equipment.find((item) => item.id === right.mountedEquipmentId)
      if (!leftItem || !rightItem) continue
      const leftDefinition = EQUIPMENT[leftItem.kind]
      const rightDefinition = EQUIPMENT[rightItem.kind]
      const required = leftDefinition.dimensions[0] / 2 + rightDefinition.dimensions[0] / 2 + Math.max(leftDefinition.clearance, rightDefinition.clearance)
      if ((rack.stationSpacingMeters ?? 2.2) < required) {
        warnings.push({ stationIds: [left.id, right.id], message: `Stations ${index + 1}–${index + 2} need ${required.toFixed(2)} m minimum spacing.` })
      }
    }
  }
  return warnings
}
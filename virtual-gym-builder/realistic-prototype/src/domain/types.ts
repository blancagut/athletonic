export type TemplateId = 'striking' | 'mma' | 'combined'
export type ViewMode = 'top' | 'perspective'
export type TransformMode = 'translate' | 'rotate'
export type MoveSnapMode = 'free' | 'fine' | 'standard'
export type RotationSnapMode = 'free' | 'fine' | 'standard'
export type InteractionState =
  | { mode: 'idle' }
  | { mode: 'selected'; objectId: string }
  | { mode: 'pending-drag'; objectId: string; pointerId: number }
  | { mode: 'dragging'; objectId: string; pointerId: number }
  | { mode: 'rotating'; objectId: string; pointerId?: number }
  | { mode: 'camera'; pointerId?: number }

export interface TransformValue {
  x: number
  z: number
  rotation: number
}

export interface SnapPreferences {
  move: MoveSnapMode
  rotation: RotationSnapMode
  wallMargin: number
}

export type FloorColor = 'black' | 'graphite' | 'gray' | 'white' | 'navy' | 'blue' | 'cyan' | 'green' | 'lime' | 'yellow' | 'orange' | 'red' | 'purple' | 'pink'
export type LogoPlacementSurface = 'floor' | 'wall-north' | 'wall-west' | 'boxing-ring' | 'mma-cage'

export interface PlacedLogo {
  id: string
  dataUrl: string
  surface: LogoPlacementSurface
  targetId?: string
  u: number
  v: number
  size: number
  rotation: number
}
export interface EquipmentCustomization {
  surfaceColor?: FloorColor
  markingColor?: FloorColor
  logos?: {
    center?: string
    sides?: string
    corners?: string
  }
}
export type RoomLayout = 'rectangular' | 'square' | 'custom'
export type AreaUnit = 'sqm' | 'sqft'
export interface RoomArchitecture {
  ceiling: boolean
  ledLighting: boolean
  windows: boolean
  doors: boolean
  columns: boolean
}
export type ArchitectureElementKind = 'window' | 'exit-door' | 'toilet-door'
export type ArchitectureWall = 'north' | 'west'
export interface ArchitectureElement {
  id: string
  kind: ArchitectureElementKind
  wall: ArchitectureWall
  normalizedPosition: number
  width: number
}
export type RackLayout = 'single' | 'linear' | 'radial' | 'square-4' | 'speed-platform' | 'double-end'
export type RackMountType = 'heavy-bag-hook' | 'speed-bag-swivel' | 'double-end-top' | 'double-end-bottom'

export interface RackStation {
  id: string
  localPosition: [number, number, number]
  localRotation: number
  mountType: RackMountType
  mountedEquipmentId: string | null
  maxLoadKg?: number
}

export interface RackConfiguration {
  layout: RackLayout
  stationCount: number
  stationSpacingMeters?: number
  stations: RackStation[]
  ceilingHeightMeters?: number
  tension?: number
}

export type EquipmentKind =
  | 'boxing-ring'
  | 'mma-cage'
  | 'wrestling-circle'
  | 'heavy-bag'
  | 'banana-bag'
  | 'banana-bag-xl'
  | 'teardrop-bag'
  | 'double-end-25x18'
  | 'double-end-30x20'
  | 'double-end-35x22'
  | 'speed-bag-18x13'
  | 'speed-bag-20x15'
  | 'speed-bag-23x18'
  | 'speed-bag-25x20'
  | 'speed-bag-28x22'
  | 'hb2-classic'
  | 'hb3-extra-large'
  | 'hb5-4ft'
  | 'hb6-6ft-banana'
  | 'hb7-pole'
  | 'hb10-bowling'
  | 'hb11-uppercut'
  | 'hb12-angle'
  | 'hb13-super-angle'
  | 'hb15-super-teardrop'
  | 'hb16-water'
  | 'uc1-wall-unit'
  | 'maddox-iii-dummy'
  | 'bag-rack-1'
  | 'bag-rack-2'
  | 'bag-rack-3'
  | 'bag-rack-4'
  | 'speed-bag-platform'
  | 'double-end-system'
  | 'bench'
  | 'equipment-rack'
  | 'reception-counter'
  | 'wall-pads'

export interface EquipmentDefinition {
  kind: EquipmentKind
  name: string
  category: string
  dimensions: [number, number, number]
  clearance: number
  description: string
}

export interface PlacedEquipment {
  id: string
  kind: EquipmentKind
  x: number
  z: number
  rotation: number
  rack?: RackConfiguration
  mountedTo?: {
    rackId: string
    stationIds: string[]
  }
  customization?: EquipmentCustomization
}

export interface GymDesign {
  version: 1
  template: TemplateId
  room: {
    width: number
    depth: number
    height: number
    layout?: RoomLayout
    areaUnit?: AreaUnit
  }
  equipment: PlacedEquipment[]
  wallsVisible: boolean
  architecture?: RoomArchitecture
  architectureElements?: ArchitectureElement[]
  logoDataUrl: string | null
  placedLogos?: PlacedLogo[]
  floor?: {
    primary: FloorColor
    border: FloorColor
    wrestlingCircles?: boolean
    wrestlingCircleCount?: number
  }
}

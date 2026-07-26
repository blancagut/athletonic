import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EQUIPMENT } from '../catalog/equipment'
import { DEFAULT_ARCHITECTURE } from '../domain/architecture'
import { compatibilityError, createRackConfiguration, ensureRackConfiguration, isRackKind } from '../domain/racks'
import { rackDimensions } from '../domain/racks'
import type { ArchitectureElement, ArchitectureElementKind, ArchitectureWall, AreaUnit, EquipmentCustomization, EquipmentKind, FloorColor, GymDesign, InteractionState, LogoPlacementSurface, MoveSnapMode, PlacedEquipment, PlacedLogo, RoomArchitecture, RoomLayout, RotationSnapMode, SnapPreferences, TemplateId, TransformMode, TransformValue, ViewMode } from '../domain/types'
import { constrainTransform, moveSnapStep, rotationSnapStep, serializeTransform, transitionInteraction, type InteractionEvent } from '../interaction/interaction'

const STORAGE_KEY = 'athletonic-realistic-gym-prototype-v1'
const DEFAULT_EQUIPMENT: PlacedEquipment[] = [
  { id: 'rack-1', kind: 'equipment-rack', x: 4.6, z: 4.7, rotation: 0 },
]
export { DEFAULT_ARCHITECTURE }

function defaultArchitectureElements(room: GymDesign['room']): ArchitectureElement[] {
  const northWindowCount = room.width >= 20 ? 4 : room.width >= 12 ? 2 : 1
  const westWindowCount = room.depth >= 18 ? 3 : room.depth >= 10 ? 2 : 1
  const positions = (count: number) => Array.from({ length: count }, (_, index) => count === 1 ? 0.35 : -0.65 + index * (1.3 / (count - 1)))
  return [
    { id: 'architecture-exit-default', kind: 'exit-door', wall: 'north', normalizedPosition: -0.56, width: 1.03 },
    { id: 'architecture-toilet-default', kind: 'toilet-door', wall: 'west', normalizedPosition: 0.54, width: 1.03 },
    ...positions(northWindowCount).map((normalizedPosition, index) => ({ id: `architecture-window-north-${index}`, kind: 'window' as const, wall: 'north' as const, normalizedPosition, width: 3 })),
    ...positions(westWindowCount).map((normalizedPosition, index) => ({ id: `architecture-window-west-${index}`, kind: 'window' as const, wall: 'west' as const, normalizedPosition, width: 3 })),
  ]
}

const templateDesigns: Record<TemplateId, Omit<GymDesign, 'logoDataUrl'>> = {
  striking: {
    version: 1,
    template: 'striking',
    room: { width: 14, depth: 11, height: 3.4 },
    wallsVisible: true,
    equipment: DEFAULT_EQUIPMENT,
  },
  mma: {
    version: 1,
    template: 'mma',
    room: { width: 15, depth: 12, height: 3.6 },
    wallsVisible: true,
    equipment: DEFAULT_EQUIPMENT,
  },
  combined: {
    version: 1,
    template: 'combined',
    room: { width: 24, depth: 14, height: 4 },
    wallsVisible: true,
    equipment: DEFAULT_EQUIPMENT,
  },
}

function freshTemplate(template: TemplateId, logoDataUrl: string | null): GymDesign {
  const source = templateDesigns[template]
  const design: GymDesign = {
    ...source,
    room: { ...source.room },
    equipment: source.equipment.map((item) => ({ ...item })),
    architecture: { ...DEFAULT_ARCHITECTURE },
    logoDataUrl,
    floor: { primary: 'black', border: template === 'mma' ? 'red' : 'blue' },
  }
  design.architectureElements = defaultArchitectureElements(design.room)
  return design
}

interface GymStore {
  design: GymDesign
  selectedId: string | null
  selectedLogoId: string | null
  selectedStationId: string | null
  view: ViewMode
  transformMode: TransformMode
  interaction: InteractionState
  snapPreferences: SnapPreferences
  transformHistory: Array<{ objectId: string; before: TransformValue; after: TransformValue }>
  frameRequest: number
  setTemplate: (template: TemplateId) => void
  setView: (view: ViewMode) => void
  setTransformMode: (mode: TransformMode) => void
  dispatchInteraction: (event: InteractionEvent) => void
  setMoveSnap: (mode: MoveSnapMode) => void
  setRotationSnap: (mode: RotationSnapMode) => void
  requestFrame: () => void
  setSelectedId: (id: string | null) => void
  setSelectedStation: (rackId: string, stationId: string) => void
  setRoom: (width: number, depth: number) => void
  setRoomLayout: (layout: RoomLayout) => void
  setAreaUnit: (unit: AreaUnit) => void
  setArchitectureOption: (option: keyof RoomArchitecture, enabled: boolean) => void
  addArchitectureElement: (kind: ArchitectureElementKind, wall: ArchitectureWall) => void
  setArchitecturePosition: (id: string, normalizedPosition: number) => void
  toggleWalls: () => void
  setLogo: (logoDataUrl: string | null) => void
  addPlacedLogo: (dataUrl: string, surface: LogoPlacementSurface, targetId?: string) => void
  setSelectedLogoId: (id: string | null) => void
  updatePlacedLogo: (id: string, update: Partial<Omit<PlacedLogo, 'id' | 'dataUrl'>>) => void
  duplicatePlacedLogo: (id: string) => void
  deletePlacedLogo: (id: string) => void
  setFloorColor: (layer: 'primary' | 'border', color: FloorColor) => void
  setWrestlingCircleCount: (count: number) => void
  addEquipment: (kind: PlacedEquipment['kind'], stationCount?: number) => void
  assignRackEquipment: (rackId: string, stationId: string, kind: EquipmentKind) => string | null
  removeRackEquipment: (rackId: string, stationId: string) => void
  setLinearStationCount: (rackId: string, count: number) => void
  setRackSpacing: (rackId: string, spacingMeters: number) => void
  setEquipmentCustomization: (id: string, update: EquipmentCustomization) => void
  updateEquipment: (id: string, update: Partial<Pick<PlacedEquipment, 'x' | 'z' | 'rotation'>>) => void
  commitEquipmentTransform: (id: string, before: TransformValue, after: TransformValue, precisionModifier?: boolean) => TransformValue | null
  rotateSelected: (amount: number) => void
  nudgeSelected: (x: number, z: number) => void
  undoTransform: () => void
  deleteSelected: () => void
  resetTemplate: () => void
}

function itemTransform(item: PlacedEquipment): TransformValue {
  return { x: item.x, z: item.z, rotation: item.rotation }
}

function normalizedTransform(state: GymStore, item: PlacedEquipment, value: TransformValue, precisionModifier = false): TransformValue {
  const rack = ensureRackConfiguration(item)
  const dimensions = rack ? rackDimensions(rack) : EQUIPMENT[item.kind].dimensions
  return constrainTransform(value, {
    roomWidth: state.design.room.width,
    roomDepth: state.design.room.depth,
    objectWidth: dimensions[0],
    objectDepth: dimensions[1],
    wallMargin: state.snapPreferences.wallMargin,
    moveSnap: moveSnapStep(state.snapPreferences.move, precisionModifier),
    rotationSnap: rotationSnapStep(state.snapPreferences.rotation, precisionModifier),
  }).value
}

export const useGymStore = create<GymStore>()(
  persist(
    (set, get) => ({
      design: freshTemplate('striking', null),
      selectedId: null,
      selectedLogoId: null,
      selectedStationId: null,
      view: 'perspective',
      transformMode: 'translate',
      interaction: { mode: 'idle' },
      snapPreferences: { move: 'fine', rotation: 'standard', wallMargin: 0.05 },
      transformHistory: [],
      frameRequest: 0,
      setTemplate: (template) => set((state) => ({
        design: freshTemplate(template, state.design.logoDataUrl),
        selectedId: null,
        selectedLogoId: null,
        selectedStationId: null,
      })),
      setView: (view) => set({ view }),
      setTransformMode: (transformMode) => set({ transformMode }),
      dispatchInteraction: (event) => set((state) => ({ interaction: transitionInteraction(state.interaction, event) })),
      setMoveSnap: (move) => set((state) => ({ snapPreferences: { ...state.snapPreferences, move } })),
      setRotationSnap: (rotation) => set((state) => ({ snapPreferences: { ...state.snapPreferences, rotation } })),
      requestFrame: () => set((state) => ({ frameRequest: state.frameRequest + 1 })),
      setSelectedId: (selectedId) => set({
        selectedId,
        selectedLogoId: null,
        selectedStationId: null,
        interaction: selectedId ? { mode: 'selected', objectId: selectedId } : { mode: 'idle' },
      }),
      setSelectedStation: (selectedId, selectedStationId) => set({ selectedId, selectedStationId }),
      setRoom: (width, depth) => set((state) => ({
        design: { ...state.design, room: { ...state.design.room, width, depth } },
      })),
      setRoomLayout: (layout) => set((state) => {
        const dimensions = layout === 'rectangular'
          ? { width: 14, depth: 10 }
          : layout === 'square'
            ? { width: 12, depth: 12 }
            : { width: state.design.room.width, depth: state.design.room.depth }
        return { design: { ...state.design, room: { ...state.design.room, ...dimensions, layout } } }
      }),
      setAreaUnit: (areaUnit) => set((state) => ({
        design: { ...state.design, room: { ...state.design.room, areaUnit } },
      })),
      setArchitectureOption: (option, enabled) => set((state) => ({
        design: {
          ...state.design,
          architecture: { ...DEFAULT_ARCHITECTURE, ...state.design.architecture, [option]: enabled },
        },
      })),
      addArchitectureElement: (kind, wall) => set((state) => {
        const id = `architecture-${kind}-${crypto.randomUUID()}`
        const element: ArchitectureElement = { id, kind, wall, normalizedPosition: 0, width: kind === 'window' ? 3 : 1.03 }
        return {
          design: { ...state.design, architectureElements: [...(state.design.architectureElements ?? defaultArchitectureElements(state.design.room)), element] },
          selectedId: id,
          selectedLogoId: null,
          selectedStationId: null,
          transformMode: 'translate',
          interaction: { mode: 'selected', objectId: id },
        }
      }),
      setArchitecturePosition: (id, normalizedPosition) => set((state) => ({
        design: {
          ...state.design,
          architectureElements: (state.design.architectureElements ?? defaultArchitectureElements(state.design.room)).map((element) => element.id === id ? { ...element, normalizedPosition } : element),
        },
      })),
      toggleWalls: () => set((state) => ({
        design: { ...state.design, wallsVisible: !state.design.wallsVisible },
      })),
      setLogo: (logoDataUrl) => set((state) => ({ design: { ...state.design, logoDataUrl } })),
      addPlacedLogo: (dataUrl, surface, targetId) => set((state) => {
        const id = `logo-${crypto.randomUUID()}`
        const placedLogo: PlacedLogo = {
          id,
          dataUrl,
          surface,
          targetId,
          u: surface === 'floor' ? state.design.room.width * 0.24 : 0,
          v: surface === 'floor' ? state.design.room.depth * 0.18 : surface.startsWith('wall-') ? 1.5 : 0,
          size: 1.4,
          rotation: 0,
        }
        return {
          design: { ...state.design, placedLogos: [...(state.design.placedLogos ?? []), placedLogo] },
          selectedId: null,
          selectedLogoId: id,
          interaction: { mode: 'idle' as const },
        }
      }),
      setSelectedLogoId: (selectedLogoId) => set({ selectedLogoId, selectedId: null, selectedStationId: null, interaction: { mode: 'idle' } }),
      updatePlacedLogo: (id, update) => set((state) => ({
        design: { ...state.design, placedLogos: (state.design.placedLogos ?? []).map((logo) => logo.id === id ? { ...logo, ...update } : logo) },
      })),
      duplicatePlacedLogo: (id) => set((state) => {
        const source = state.design.placedLogos?.find((logo) => logo.id === id)
        if (!source) return state
        const horizontalLimit = source.surface === 'wall-west'
          ? state.design.room.depth / 2 - 0.5
          : source.surface === 'boxing-ring'
            ? 2.7
            : source.surface === 'mma-cage'
              ? 3.8
              : state.design.room.width / 2 - 0.5
        const verticalLimit = source.surface.startsWith('wall-')
          ? state.design.room.height - 0.3
          : source.surface === 'boxing-ring'
            ? 2.7
            : source.surface === 'mma-cage'
              ? 3.8
              : state.design.room.depth / 2 - 0.5
        const duplicate = {
          ...source,
          id: `logo-${crypto.randomUUID()}`,
          u: Math.min(horizontalLimit, source.u + 0.4),
          v: Math.min(verticalLimit, source.v + (source.surface.startsWith('wall-') ? 0.25 : 0.4)),
        }
        return { design: { ...state.design, placedLogos: [...(state.design.placedLogos ?? []), duplicate] }, selectedLogoId: duplicate.id }
      }),
      deletePlacedLogo: (id) => set((state) => ({
        design: { ...state.design, placedLogos: (state.design.placedLogos ?? []).filter((logo) => logo.id !== id) },
        selectedLogoId: state.selectedLogoId === id ? null : state.selectedLogoId,
      })),
      setFloorColor: (layer, color) => set((state) => ({
        design: {
          ...state.design,
          floor: { primary: 'black', border: 'blue', ...state.design.floor, [layer]: color },
        },
      })),
      setWrestlingCircleCount: (count) => set((state) => ({
        design: {
          ...state.design,
          floor: {
            primary: 'black',
            border: 'blue',
            ...state.design.floor,
            wrestlingCircles: undefined,
            wrestlingCircleCount: Math.max(0, Math.floor(count)),
          },
        },
      })),
      addEquipment: (kind, stationCount) => set((state) => {
        const id = `${kind}-${crypto.randomUUID()}`
        const item: PlacedEquipment = {
            id,
            kind,
            x: 0,
            z: 0,
            rotation: 0,
        }
        if (isRackKind(kind)) item.rack = createRackConfiguration(kind, stationCount)
        return {
          design: { ...state.design, equipment: [...state.design.equipment, item] },
          selectedId: id,
          selectedStationId: item.rack?.stations[0]?.id ?? null,
          interaction: { mode: 'selected' as const, objectId: id },
        }
      }),
      assignRackEquipment: (rackId, stationId, kind) => {
        const rackItem = get().design.equipment.find((item) => item.id === rackId)
        const rack = rackItem && ensureRackConfiguration(rackItem)
        const target = rack?.stations.find((station) => station.id === stationId)
        if (!rackItem || !rack || !target) return 'Rack station was not found.'
        const incompatible = compatibilityError(target.mountType, kind)
        if (incompatible) return incompatible
        const equipmentId = `${kind}-${crypto.randomUUID()}`
        const pairedStationIds = target.mountType.startsWith('double-end')
          ? rack.stations.filter((station) => station.mountType.startsWith('double-end')).map((station) => station.id)
          : [stationId]
        const replacedIds = new Set(rack.stations.filter((station) => pairedStationIds.includes(station.id)).map((station) => station.mountedEquipmentId).filter(Boolean))
        set((state) => ({
          design: {
            ...state.design,
            equipment: [
              ...state.design.equipment.filter((item) => !replacedIds.has(item.id)).map((item) => item.id === rackId ? {
                ...item,
                rack: {
                  ...rack,
                  stations: rack.stations.map((station) => pairedStationIds.includes(station.id) ? { ...station, mountedEquipmentId: equipmentId } : station),
                },
              } : item),
              { id: equipmentId, kind, x: 0, z: 0, rotation: 0, mountedTo: { rackId, stationIds: pairedStationIds } },
            ],
          },
        }))
        return null
      },
      removeRackEquipment: (rackId, stationId) => set((state) => {
        const rackItem = state.design.equipment.find((item) => item.id === rackId)
        const rack = rackItem && ensureRackConfiguration(rackItem)
        const target = rack?.stations.find((station) => station.id === stationId)
        if (!rackItem || !rack || !target?.mountedEquipmentId) return state
        const equipmentId = target.mountedEquipmentId
        return {
          design: {
            ...state.design,
            equipment: state.design.equipment.filter((item) => item.id !== equipmentId).map((item) => item.id === rackId ? {
              ...item,
              rack: { ...rack, stations: rack.stations.map((station) => station.mountedEquipmentId === equipmentId ? { ...station, mountedEquipmentId: null } : station) },
            } : item),
          },
        }
      }),
      setLinearStationCount: (rackId, requestedCount) => set((state) => {
        const rackItem = state.design.equipment.find((item) => item.id === rackId)
        const current = rackItem && ensureRackConfiguration(rackItem)
        if (!rackItem || !current || current.layout !== 'linear') return state
        const count = Math.max(1, Math.floor(requestedCount))
        const next = createRackConfiguration('bag-rack-2', count)
        next.stationSpacingMeters = current.stationSpacingMeters ?? next.stationSpacingMeters
        next.stations = next.stations.map((station, index) => ({
          ...station,
          localPosition: [(index - (count - 1) / 2) * (next.stationSpacingMeters ?? 2.2), station.localPosition[1], station.localPosition[2]],
          mountedEquipmentId: current.stations[index]?.mountedEquipmentId ?? null,
        }))
        const detachedIds = new Set(current.stations.slice(count).map((station) => station.mountedEquipmentId).filter(Boolean))
        return {
          design: {
            ...state.design,
            equipment: state.design.equipment.map((item) => {
              if (item.id === rackId) return { ...item, rack: next }
              if (detachedIds.has(item.id)) return { ...item, x: rackItem.x, z: rackItem.z + 1.5, rotation: rackItem.rotation, mountedTo: undefined }
              return item
            }),
          },
        }
      }),
      setRackSpacing: (rackId, requestedSpacing) => set((state) => ({
        design: {
          ...state.design,
          equipment: state.design.equipment.map((item) => {
            if (item.id !== rackId) return item
            const rack = ensureRackConfiguration(item)
            if (!rack || rack.layout !== 'linear') return item
            const spacing = Math.max(1.2, Math.min(5, requestedSpacing))
            return {
              ...item,
              rack: {
                ...rack,
                stationSpacingMeters: spacing,
                stations: rack.stations.map((station, index) => ({ ...station, localPosition: [(index - (rack.stationCount - 1) / 2) * spacing, station.localPosition[1], station.localPosition[2]] })),
              },
            }
          }),
        },
      })),
      setEquipmentCustomization: (id, update) => set((state) => ({
        design: {
          ...state.design,
          equipment: state.design.equipment.map((item) => item.id === id ? {
            ...item,
            customization: {
              ...item.customization,
              ...update,
              logos: update.logos ? { ...item.customization?.logos, ...update.logos } : item.customization?.logos,
            },
          } : item),
        },
      })),
      updateEquipment: (id, update) => set((state) => ({
        design: {
          ...state.design,
          equipment: state.design.equipment.map((item) => item.id === id ? { ...item, ...update } : item),
        },
      })),
      commitEquipmentTransform: (id, before, after, precisionModifier = false) => {
        const state = get()
        const item = state.design.equipment.find((candidate) => candidate.id === id && !candidate.mountedTo)
        if (!item) return null
        const normalizedBefore = serializeTransform(before)
        const normalizedAfter = normalizedTransform(state, item, after, precisionModifier)
        const changed = normalizedBefore.x !== normalizedAfter.x
          || normalizedBefore.z !== normalizedAfter.z
          || normalizedBefore.rotation !== normalizedAfter.rotation
        set((current) => ({
          design: changed ? {
            ...current.design,
            equipment: current.design.equipment.map((candidate) => candidate.id === id ? { ...candidate, ...normalizedAfter } : candidate),
          } : current.design,
          interaction: { mode: 'selected', objectId: id },
          transformHistory: changed
            ? [...current.transformHistory.slice(-49), { objectId: id, before: normalizedBefore, after: normalizedAfter }]
            : current.transformHistory,
        }))
        return normalizedAfter
      },
      rotateSelected: (amount) => {
        const selectedId = get().selectedId
        if (!selectedId) return
        const item = get().design.equipment.find((candidate) => candidate.id === selectedId)
        if (!item) return
        get().commitEquipmentTransform(selectedId, itemTransform(item), { ...itemTransform(item), rotation: item.rotation + amount })
      },
      nudgeSelected: (x, z) => {
        const selectedId = get().selectedId
        const item = get().design.equipment.find((candidate) => candidate.id === selectedId)
        if (!item || !selectedId) return
        get().commitEquipmentTransform(selectedId, itemTransform(item), { ...itemTransform(item), x: item.x + x, z: item.z + z }, true)
      },
      undoTransform: () => {
        const history = get().transformHistory
        const entry = history.at(-1)
        if (!entry) return
        set((state) => ({
          design: {
            ...state.design,
            equipment: state.design.equipment.map((item) => item.id === entry.objectId ? { ...item, ...entry.before } : item),
          },
          selectedId: entry.objectId,
          interaction: { mode: 'selected', objectId: entry.objectId },
          transformHistory: state.transformHistory.slice(0, -1),
        }))
      },
      deleteSelected: () => set((state) => ({
        design: {
          ...state.design,
          equipment: state.design.equipment.filter((item) => item.id !== state.selectedId),
          architectureElements: (state.design.architectureElements ?? defaultArchitectureElements(state.design.room)).filter((element) => element.id !== state.selectedId),
          placedLogos: (state.design.placedLogos ?? []).filter((logo) => logo.targetId !== state.selectedId),
        },
        selectedId: null,
        selectedStationId: null,
      })),
      resetTemplate: () => set((state) => ({
        design: freshTemplate(state.design.template, state.design.logoDataUrl),
        selectedId: null,
        selectedLogoId: null,
        selectedStationId: null,
      })),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persistedState, version) => {
        const restored = persistedState as Partial<GymStore>
        if (!restored.design) return persistedState as GymStore
        return {
          ...restored,
          design: {
            ...restored.design,
            equipment: version < 2 ? DEFAULT_EQUIPMENT.map((item) => ({ ...item })) : restored.design.equipment,
            architecture: {
              ...DEFAULT_ARCHITECTURE,
              ...restored.design.architecture,
              ...(version < 1 ? { ceiling: false, ledLighting: false } : {}),
            },
          },
        } as GymStore
      },
      partialize: (state) => ({ design: state.design, snapPreferences: state.snapPreferences }),
      merge: (persisted, current) => {
        const restored = persisted as Partial<GymStore>
        if (!restored.design) return current
        return {
          ...current,
          ...restored,
          design: {
            ...restored.design,
            placedLogos: restored.design.placedLogos ?? [],
            architectureElements: restored.design.architectureElements ?? defaultArchitectureElements(restored.design.room),
            equipment: restored.design.equipment.map((item) => isRackKind(item.kind) && !item.rack
              ? { ...item, rack: createRackConfiguration(item.kind) }
              : item),
          },
        }
      },
    },
  ),
)

import type { InteractionState, MoveSnapMode, RotationSnapMode, TransformValue } from '../domain/types.ts'

export const MOUSE_DRAG_THRESHOLD = 6
export const TOUCH_DRAG_THRESHOLD = 10
export const MOVE_SNAP_METERS: Record<Exclude<MoveSnapMode, 'free'>, number> = { fine: 0.05, standard: 0.25 }
export const ROTATION_SNAP_RADIANS: Record<Exclude<RotationSnapMode, 'free'>, number> = {
  fine: Math.PI / 180,
  standard: Math.PI / 12,
}

export type InteractionEvent =
  | { type: 'select'; objectId: string }
  | { type: 'deselect' }
  | { type: 'pointer-down'; objectId: string; pointerId: number }
  | { type: 'drag-threshold'; pointerId: number }
  | { type: 'rotate-start'; objectId: string; pointerId?: number }
  | { type: 'camera-start'; pointerId?: number }
  | { type: 'complete' }
  | { type: 'cancel' }

export function transitionInteraction(state: InteractionState, event: InteractionEvent): InteractionState {
  switch (event.type) {
    case 'select':
      return { mode: 'selected', objectId: event.objectId }
    case 'deselect':
      return { mode: 'idle' }
    case 'pointer-down':
      if (state.mode === 'camera' || (state.mode !== 'idle' && state.mode !== 'selected')) return state
      return { mode: 'pending-drag', objectId: event.objectId, pointerId: event.pointerId }
    case 'drag-threshold':
      return state.mode === 'pending-drag' && state.pointerId === event.pointerId
        ? { ...state, mode: 'dragging' }
        : state
    case 'rotate-start':
      if (state.mode === 'camera' || state.mode === 'dragging') return state
      return { mode: 'rotating', objectId: event.objectId, pointerId: event.pointerId }
    case 'camera-start':
      return state.mode === 'idle' || state.mode === 'selected' || state.mode === 'camera'
        ? { mode: 'camera', pointerId: event.pointerId }
        : state
    case 'complete':
    case 'cancel':
      return 'objectId' in state ? { mode: 'selected', objectId: state.objectId } : { mode: 'idle' }
  }
}

export function exceededDragThreshold(startX: number, startY: number, x: number, y: number, pointerType: string): boolean {
  const threshold = pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD : MOUSE_DRAG_THRESHOLD
  return Math.hypot(x - startX, y - startY) >= threshold
}

export function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  const normalized = ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
  return Math.abs(normalized) < 1e-10 ? 0 : normalized
}

export function snapValue(value: number, step: number | null): number {
  if (!step) return value
  return Math.round(value / step) * step
}

export function moveSnapStep(mode: MoveSnapMode, precisionModifier = false): number | null {
  if (precisionModifier) return MOVE_SNAP_METERS.fine
  return mode === 'free' ? null : MOVE_SNAP_METERS[mode]
}

export function rotationSnapStep(mode: RotationSnapMode, precisionModifier = false): number | null {
  if (precisionModifier) return ROTATION_SNAP_RADIANS.fine
  return mode === 'free' ? null : ROTATION_SNAP_RADIANS[mode]
}

export interface ConstrainTransformOptions {
  roomWidth: number
  roomDepth: number
  objectWidth: number
  objectDepth: number
  wallMargin: number
  moveSnap: number | null
  rotationSnap: number | null
}

export interface ConstrainedTransform {
  value: TransformValue
  oversized: boolean
}

export function constrainTransform(transform: TransformValue, options: ConstrainTransformOptions): ConstrainedTransform {
  const rotation = normalizeAngle(snapValue(transform.rotation, options.rotationSnap))
  const cosine = Math.abs(Math.cos(rotation))
  const sine = Math.abs(Math.sin(rotation))
  const halfWidth = (options.objectWidth * cosine + options.objectDepth * sine) / 2
  const halfDepth = (options.objectWidth * sine + options.objectDepth * cosine) / 2
  const limitX = options.roomWidth / 2 - options.wallMargin - halfWidth
  const limitZ = options.roomDepth / 2 - options.wallMargin - halfDepth
  const oversized = limitX < 0 || limitZ < 0
  const snappedX = snapValue(transform.x, options.moveSnap)
  const snappedZ = snapValue(transform.z, options.moveSnap)

  return {
    oversized,
    value: serializeTransform({
      x: limitX < 0 ? 0 : Math.max(-limitX, Math.min(limitX, snappedX)),
      z: limitZ < 0 ? 0 : Math.max(-limitZ, Math.min(limitZ, snappedZ)),
      rotation,
    }),
  }
}

export function serializeTransform(value: TransformValue): TransformValue {
  const clean = (number: number) => Number(number.toFixed(6))
  return { x: clean(value.x), z: clean(value.z), rotation: clean(normalizeAngle(value.rotation)) }
}
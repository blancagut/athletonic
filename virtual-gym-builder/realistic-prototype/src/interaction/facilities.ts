import type { TransformValue } from '../domain/types.ts'
import { normalizeAngle, serializeTransform } from './interaction.ts'

const WALL_THICKNESS_METERS = 0.18
const WALL_MOUNT_TOLERANCE_METERS = 0.015
const WALL_SNAP_DISTANCE_METERS = 0.25
const WALL_SNAP_ANGLE_RADIANS = Math.PI / 24

export type WallSide = 'north' | 'east' | 'south' | 'west'

interface WallMountOptions {
  roomWidth: number
  roomDepth: number
  padWidth: number
  padDepth: number
}

interface WallTarget {
  side: WallSide
  x: number | null
  z: number | null
  rotation: number
}

function targets(options: WallMountOptions): WallTarget[] {
  const x = options.roomWidth / 2 - WALL_THICKNESS_METERS / 2 - options.padDepth / 2
  const z = options.roomDepth / 2 - WALL_THICKNESS_METERS / 2 - options.padDepth / 2
  return [
    { side: 'north', x: null, z: -z, rotation: 0 },
    { side: 'east', x, z: null, rotation: -Math.PI / 2 },
    { side: 'south', x: null, z, rotation: Math.PI },
    { side: 'west', x: -x, z: null, rotation: Math.PI / 2 },
  ]
}

function angleDistance(left: number, right: number): number {
  return Math.abs(normalizeAngle(left - right))
}

function isWithinWallSpan(transform: TransformValue, target: WallTarget, options: WallMountOptions): boolean {
  const halfSpan = options.padWidth / 2
  return target.x === null
    ? Math.abs(transform.x) + halfSpan <= options.roomWidth / 2 + WALL_MOUNT_TOLERANCE_METERS
    : Math.abs(transform.z) + halfSpan <= options.roomDepth / 2 + WALL_MOUNT_TOLERANCE_METERS
}

export function wallMountSide(transform: TransformValue, options: WallMountOptions): WallSide | null {
  for (const target of targets(options)) {
    const offset = target.x === null
      ? Math.abs(transform.z - (target.z as number))
      : Math.abs(transform.x - target.x)
    if (
      offset <= WALL_MOUNT_TOLERANCE_METERS
      && angleDistance(transform.rotation, target.rotation) <= WALL_SNAP_ANGLE_RADIANS
      && isWithinWallSpan(transform, target, options)
    ) return target.side
  }
  return null
}

export function snapWallPadToMount(transform: TransformValue, options: WallMountOptions): TransformValue {
  let nearest: { target: WallTarget; distance: number } | null = null
  for (const target of targets(options)) {
    const distance = target.x === null
      ? Math.abs(transform.z - (target.z as number))
      : Math.abs(transform.x - target.x)
    if (
      distance <= WALL_SNAP_DISTANCE_METERS
      && angleDistance(transform.rotation, target.rotation) <= WALL_SNAP_ANGLE_RADIANS
      && isWithinWallSpan(transform, target, options)
      && (!nearest || distance < nearest.distance)
    ) nearest = { target, distance }
  }
  if (!nearest) return serializeTransform(transform)
  return serializeTransform({
    x: nearest.target.x ?? transform.x,
    z: nearest.target.z ?? transform.z,
    rotation: nearest.target.rotation,
  })
}

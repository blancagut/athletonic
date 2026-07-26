import { Html, Line } from '@react-three/drei'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { type ReactNode, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ArchitectureElement } from '../domain/types'
import { exceededDragThreshold, moveSnapStep } from '../interaction/interaction'
import { DEFAULT_ARCHITECTURE, useGymStore } from '../state/gymStore'
import {
  constrainWallPosition,
  normalizeWallPosition,
  type ReservedSpan,
} from './windowLayout'

const ACCENT = '#d8ff3e'
const DOOR_WIDTH = 1.03
const WINDOW_GAP = 0.36

interface PositionedElement extends ArchitectureElement {
  center: number
}

function MovableWallElement({
  id,
  axis,
  center,
  wallLength,
  elementWidth,
  elementHeight,
  reserved,
  x,
  z,
  rotation = 0,
  children,
}: {
  id: string
  axis: 'x' | 'z'
  center: number
  wallLength: number
  elementWidth: number
  elementHeight: number
  reserved: ReservedSpan[]
  x: number
  z: number
  rotation?: number
  children: ReactNode
}) {
  const selectedId = useGymStore((state) => state.selectedId)
  const setSelectedId = useGymStore((state) => state.setSelectedId)
  const dispatchInteraction = useGymStore((state) => state.dispatchInteraction)
  const setArchitecturePosition = useGymStore((state) => state.setArchitecturePosition)
  const transformMode = useGymStore((state) => state.transformMode)
  const snapPreferences = useGymStore((state) => state.snapPreferences)
  const invalidate = useThree((state) => state.invalidate)
  const groupRef = useRef<THREE.Group>(null)
  const pointerStart = useRef<{ x: number; y: number; coordinate: number; center: number; type: string; id: number } | null>(null)
  const captureTarget = useRef<Element | null>(null)
  const dragging = useRef(false)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const selected = selectedId === id

  const clearGesture = () => {
    pointerStart.current = null
    captureTarget.current = null
    dragging.current = false
  }

  const cancelGesture = () => {
    const start = pointerStart.current
    if (!start || !groupRef.current) return
    const target = captureTarget.current
    groupRef.current.position[axis] = center
    clearGesture()
    if (target?.hasPointerCapture(start.id)) target.releasePointerCapture(start.id)
    dispatchInteraction({ type: 'cancel' })
    invalidate()
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setSelectedId(id)
    if (transformMode !== 'translate' || !groupRef.current) return
    const floorPoint = event.ray.intersectPlane(floorPlane, new THREE.Vector3())
    if (!floorPoint) return
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      coordinate: floorPoint[axis],
      center,
      type: event.pointerType,
      id: event.pointerId,
    }
    captureTarget.current = event.target as Element
    dispatchInteraction({ type: 'pointer-down', objectId: id, pointerId: event.pointerId })
    captureTarget.current.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId || !groupRef.current) return
    event.stopPropagation()
    if (!dragging.current) {
      if (!exceededDragThreshold(start.x, start.y, event.clientX, event.clientY, start.type)) return
      dragging.current = true
      dispatchInteraction({ type: 'drag-threshold', pointerId: event.pointerId })
    }
    const floorPoint = event.ray.intersectPlane(floorPlane, new THREE.Vector3())
    if (!floorPoint) return
    groupRef.current.position[axis] = constrainWallPosition(
      start.center + floorPoint[axis] - start.coordinate,
      elementWidth,
      wallLength,
      reserved,
      moveSnapStep(snapPreferences.move, event.shiftKey),
    )
    invalidate()
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId || !groupRef.current) return
    event.stopPropagation()
    const target = captureTarget.current
    if (dragging.current) {
      setArchitecturePosition(id, normalizeWallPosition(groupRef.current.position[axis], wallLength))
      dispatchInteraction({ type: 'complete' })
    } else {
      dispatchInteraction({ type: 'complete' })
    }
    clearGesture()
    if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={(event) => { event.stopPropagation(); setSelectedId(id) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
    >
      {children}
      {selected && (
        <Line
          points={[
            [-elementWidth / 2 - 0.06, 0.72, 0.19],
            [elementWidth / 2 + 0.06, 0.72, 0.19],
            [elementWidth / 2 + 0.06, 0.72 + elementHeight + 0.12, 0.19],
            [-elementWidth / 2 - 0.06, 0.72 + elementHeight + 0.12, 0.19],
            [-elementWidth / 2 - 0.06, 0.72, 0.19],
          ]}
          color={ACCENT}
          lineWidth={2}
          depthTest={false}
        />
      )}
    </group>
  )
}

function DoorAssembly({ label, color }: { label: string; color: string }) {
  return (
    <group>
      <mesh position={[0, 1.07, 0.105]} castShadow>
        <boxGeometry args={[DOOR_WIDTH, 2.14, 0.08]} />
        <meshStandardMaterial color="#737b78" metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh position={[0, 1.06, 0.155]} castShadow receiveShadow>
        <boxGeometry args={[0.91, 2.02, 0.055]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh position={[0.32, 1.02, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
        <meshStandardMaterial color="#c9cecc" metalness={0.82} roughness={0.22} />
      </mesh>
      <mesh position={[0, 1.75, 0.19]}>
        <boxGeometry args={[0.64, 0.25, 0.018]} />
        <meshStandardMaterial color={label === 'EXIT' ? '#167243' : '#202625'} roughness={0.65} />
      </mesh>
      <Html position={[0, 1.75, 0.205]} center transform distanceFactor={5.5}>
        <span style={{ display: 'block', width: '64px', color: '#fff', fontSize: '10px', fontWeight: 900, letterSpacing: '0.08em', lineHeight: '25px', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
      </Html>
    </group>
  )
}

function WindowAssembly({ width, height }: { width: number; height: number }) {
  const frameWidth = 0.045
  const glassWidth = width - frameWidth * 2
  const glassHeight = height - frameWidth * 2
  const sillHeight = 0.82
  const frameMaterial = <meshStandardMaterial color="#252c2b" metalness={0.78} roughness={0.3} />

  return (
    <group position={[0, sillHeight + height / 2, 0]}>
      <mesh position={[0, 0, -0.015]} receiveShadow>
        <boxGeometry args={[width + 0.12, height + 0.12, 0.035]} />
        <meshStandardMaterial color="#38413f" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[glassWidth, glassHeight]} />
        <meshPhysicalMaterial color="#a9cbd2" transmission={0.38} transparent opacity={0.66} roughness={0.16} metalness={0.02} clearcoat={0.55} clearcoatRoughness={0.24} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={`side-${side}`} position={[side * (width / 2 - frameWidth / 2), 0, 0.07]} castShadow><boxGeometry args={[frameWidth, height, 0.055]} />{frameMaterial}</mesh>)}
      {[-1, 1].map((side) => <mesh key={`rail-${side}`} position={[0, side * (height / 2 - frameWidth / 2), 0.07]} castShadow><boxGeometry args={[width, frameWidth, 0.055]} />{frameMaterial}</mesh>)}
      {width >= 3.15 && <mesh position={[0, 0, 0.072]} castShadow><boxGeometry args={[0.032, glassHeight, 0.05]} />{frameMaterial}</mesh>}
      <mesh position={[0, -height / 2 - 0.045, 0.075]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.16, 0.055, 0.16]} />
        <meshStandardMaterial color="#596260" metalness={0.32} roughness={0.52} />
      </mesh>
    </group>
  )
}

function resolveElements(elements: ArchitectureElement[], wallLength: number, columnReservations: ReservedSpan[]): PositionedElement[] {
  const resolved: PositionedElement[] = []
  for (const element of elements) {
    const center = constrainWallPosition(element.normalizedPosition * wallLength / 2, element.width, wallLength, [
      ...columnReservations,
      ...resolved.map((other) => ({ center: other.center, radius: other.width / 2 + WINDOW_GAP })),
    ], 0.05)
    resolved.push({ ...element, center })
  }
  return resolved
}

export function ArchitecturalElements({ width, depth, height }: { width: number; depth: number; height: number }) {
  const view = useGymStore((state) => state.view)
  const configured = useGymStore((state) => state.design.architecture)
  const elements = useGymStore((state) => state.design.architectureElements) ?? []
  const architecture = { ...DEFAULT_ARCHITECTURE, ...configured }
  const ledXs = [-width * 0.25, width * 0.25]
  const ledZs = [-depth * 0.25, depth * 0.25]
  const columnInset = Math.min(2.2, Math.min(width, depth) * 0.18)
  const northColumnReservations: ReservedSpan[] = []
  const westColumnReservations: ReservedSpan[] = []
  if (architecture.columns) {
    northColumnReservations.push({ center: -width / 2 + columnInset, radius: 0.48 }, { center: width / 2 - columnInset, radius: 0.48 })
    westColumnReservations.push({ center: -depth / 2 + columnInset, radius: 0.48 }, { center: depth / 2 - columnInset, radius: 0.48 })
  }
  const northElements = resolveElements(elements.filter((element) => element.wall === 'north'), width, northColumnReservations)
  const westElements = resolveElements(elements.filter((element) => element.wall === 'west'), depth, westColumnReservations)
  const windowHeight = Math.min(1.62, Math.max(1.18, height - 1.35))
  const renderElement = (element: PositionedElement, wallElements: PositionedElement[], wallLength: number) => {
    const north = element.wall === 'north'
    const isWindow = element.kind === 'window'
    if ((isWindow && !architecture.windows) || (!isWindow && !architecture.doors)) return null
    return (
      <MovableWallElement
        key={element.id}
        id={element.id}
        axis={north ? 'x' : 'z'}
        center={element.center}
        wallLength={wallLength}
        elementWidth={element.width}
        elementHeight={isWindow ? windowHeight : 2.14}
        reserved={[
          ...(north ? northColumnReservations : westColumnReservations),
          ...wallElements.filter((other) => other.id !== element.id).map((other) => ({ center: other.center, radius: other.width / 2 + WINDOW_GAP })),
        ]}
        x={north ? element.center : -width / 2 + 0.1}
        z={north ? -depth / 2 + 0.1 : element.center}
        rotation={north ? 0 : Math.PI / 2}
      >
        {isWindow
          ? <WindowAssembly width={element.width} height={windowHeight} />
          : <DoorAssembly label={element.kind === 'exit-door' ? 'EXIT' : 'TOILET'} color={element.kind === 'exit-door' ? '#39423f' : '#dde1df'} />}
      </MovableWallElement>
    )
  }

  return (
    <group>
      {northElements.map((element) => renderElement(element, northElements, width))}
      {westElements.map((element) => renderElement(element, westElements, depth))}
      {architecture.ceiling && view === 'perspective' && (
        <group position={[0, height, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color="#d9dddb" transparent opacity={0.18} side={THREE.DoubleSide} roughness={0.82} depthWrite={false} /></mesh>
          {[-depth / 2, 0, depth / 2].map((z) => <mesh key={`roof-x-${z}`} position={[0, -0.04, z]}><boxGeometry args={[width, 0.08, 0.08]} /><meshStandardMaterial color="#8d9692" /></mesh>)}
          {[-width / 2, 0, width / 2].map((x) => <mesh key={`roof-z-${x}`} position={[x, -0.04, 0]}><boxGeometry args={[0.08, 0.08, depth]} /><meshStandardMaterial color="#8d9692" /></mesh>)}
        </group>
      )}
      {architecture.ledLighting && ledXs.flatMap((x) => ledZs.map((z) => (
        <group key={`led-${x}-${z}`} position={[x, height - 0.12, z]}>
          <mesh castShadow><boxGeometry args={[1.8, 0.055, 0.18]} /><meshStandardMaterial color="#eef4ef" emissive="#f5fff6" emissiveIntensity={3.4} /></mesh>
          <pointLight position={[0, -0.2, 0]} intensity={7} distance={Math.max(7, Math.min(width, depth) * 0.7)} decay={2} color="#f4fff5" />
        </group>
      )))}
      {architecture.columns && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sideX, sideZ]) => (
        <group key={`column-${sideX}-${sideZ}`} position={[sideX * (width / 2 - columnInset), 0, sideZ * (depth / 2 - columnInset)]}>
          <mesh position={[0, height / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.42, height, 0.42]} /><meshStandardMaterial color="#c9cecc" roughness={0.78} /></mesh>
          <mesh position={[0, 0.07, 0]}><boxGeometry args={[0.56, 0.14, 0.56]} /><meshStandardMaterial color="#737c78" roughness={0.66} /></mesh>
        </group>
      ))}
    </group>
  )
}

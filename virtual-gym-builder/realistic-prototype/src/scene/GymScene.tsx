import { Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera, TransformControls } from '@react-three/drei'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EQUIPMENT } from '../catalog/equipment'
import { MODEL_ASSETS } from '../catalog/modelAssets'
import { ensureRackConfiguration, isRackKind, rackDimensions } from '../domain/racks'
import type { EquipmentCustomization, FloorColor, PlacedEquipment, PlacedLogo, RackConfiguration, RackStation, TransformValue } from '../domain/types'
import { snapWallPadToMount, wallMountSide } from '../interaction/facilities'
import { constrainTransform, exceededDragThreshold, moveSnapStep, rotationSnapStep } from '../interaction/interaction'
import { useGymStore } from '../state/gymStore'
import { ArchitecturalElements } from './ArchitecturalElements'
import { Bench, EquipmentRack, ReceptionCounter, WallPads } from './FacilitiesModels'
import { LicensedModel } from './LicensedModel'
import { CANVAS_BUMP_TEXTURE, EVA_BUMP_TEXTURE, POWDER_COAT_BUMP_TEXTURE } from './materialTextures'
import { isProductBagKind, ProductBagModel } from './ProductBagModels'
import { BLACK_LEATHER_BUMP_TEXTURE } from './bagMaterials'

const ACCENT = '#d8ff3e'
const STEEL = '#69726f'
const FLOOR_COLORS: Record<FloorColor, string> = {
  black: '#161a19',
  graphite: '#343a38',
  gray: '#858b88',
  white: '#e9ece8',
  navy: '#172b4d',
  blue: '#1757a6',
  cyan: '#159eb3',
  green: '#247348',
  lime: '#9cbd24',
  yellow: '#e0ba24',
  orange: '#d66a25',
  red: '#b72e2b',
  purple: '#694a8e',
  pink: '#c65079',
}

function CameraRig() {
  const view = useGymStore((state) => state.view)
  const room = useGymStore((state) => state.design.room)
  const interactionMode = useGymStore((state) => state.interaction.mode)
  const dispatchInteraction = useGymStore((state) => state.dispatchInteraction)
  const invalidate = useThree((state) => state.invalidate)
  const span = Math.max(room.width, room.depth)
  const cameraEnabled = interactionMode === 'idle' || interactionMode === 'selected' || interactionMode === 'camera'

  useEffect(() => invalidate(), [invalidate, room, view])

  if (view === 'top') {
    return (
      <>
        <OrthographicCamera makeDefault position={[0, 30, 0.01]} up={[0, 0, -1]} zoom={Math.max(24, 620 / span)} near={0.1} far={80} />
        <OrbitControls
          makeDefault
          enabled={cameraEnabled}
          enableRotate={false}
          enableDamping
          dampingFactor={0.08}
          minZoom={18}
          maxZoom={100}
          onStart={() => dispatchInteraction({ type: 'camera-start' })}
          onEnd={() => dispatchInteraction({ type: 'complete' })}
        />
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[span * 0.68, span * 0.58, span * 0.76]} fov={42} near={0.1} far={140} />
      <OrbitControls
        makeDefault
        enabled={cameraEnabled}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={4}
        maxDistance={55}
        target={[0, 0.6, 0]}
        onStart={() => dispatchInteraction({ type: 'camera-start' })}
        onEnd={() => dispatchInteraction({ type: 'complete' })}
      />
    </>
  )
}

function LogoMark({ dataUrl, size, height }: { dataUrl: string; size: number; height: number }) {
  const [aspectRatio, setAspectRatio] = useState(1)
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(dataUrl, (resolvedTexture) => {
      const image = resolvedTexture.image as HTMLImageElement
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setAspectRatio(image.naturalWidth / image.naturalHeight)
      }
    })
    loaded.colorSpace = THREE.SRGBColorSpace
    return loaded
  }, [dataUrl])

  useEffect(() => () => texture.dispose(), [texture])

  const width = aspectRatio >= 1 ? size : size * aspectRatio
  const depth = aspectRatio >= 1 ? size / aspectRatio : size

  return (
    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function VerticalLogoMark({ dataUrl, maxWidth, maxHeight, position, rotation, roll = 0 }: { dataUrl: string; maxWidth: number; maxHeight: number; position: THREE.Vector3Tuple; rotation: number; roll?: number }) {
  const [aspectRatio, setAspectRatio] = useState(1)
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(dataUrl, (resolvedTexture) => {
      const image = resolvedTexture.image as HTMLImageElement
      if (image.naturalWidth > 0 && image.naturalHeight > 0) setAspectRatio(image.naturalWidth / image.naturalHeight)
    })
    loaded.colorSpace = THREE.SRGBColorSpace
    return loaded
  }, [dataUrl])

  useEffect(() => () => texture.dispose(), [texture])

  const width = aspectRatio >= maxWidth / maxHeight ? maxWidth : maxHeight * aspectRatio
  const height = aspectRatio >= maxWidth / maxHeight ? maxWidth / aspectRatio : maxHeight

  return (
    <mesh position={position} rotation={[0, rotation, roll]} renderOrder={6}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function HorizontalPlacedLogo({ logo, height }: { logo: PlacedLogo; height: number }) {
  const setSelectedLogoId = useGymStore((state) => state.setSelectedLogoId)
  const selectedLogoId = useGymStore((state) => state.selectedLogoId)
  const updatePlacedLogo = useGymStore((state) => state.updatePlacedLogo)
  const dispatchInteraction = useGymStore((state) => state.dispatchInteraction)
  const invalidate = useThree((state) => state.invalidate)
  const room = useGymStore((state) => state.design.room)
  const groupRef = useRef<THREE.Group>(null)
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragOffset = useRef(new THREE.Vector3())
  const draggingPointer = useRef<number | null>(null)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setSelectedLogoId(logo.id)
    if (!groupRef.current?.parent) return
    const worldPosition = groupRef.current.getWorldPosition(new THREE.Vector3())
    dragPlane.current.constant = -worldPosition.y
    const point = event.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
    if (!point) return
    const localPoint = groupRef.current.parent.worldToLocal(point.clone())
    dragOffset.current.set(logo.u - localPoint.x, 0, logo.v - localPoint.z)
    draggingPointer.current = event.pointerId
    dispatchInteraction({ type: 'pointer-down', objectId: logo.id, pointerId: event.pointerId })
    ;(event.target as Element).setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (draggingPointer.current !== event.pointerId || !groupRef.current?.parent) return
    event.stopPropagation()
    const point = event.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
    if (!point) return
    const localPoint = groupRef.current.parent.worldToLocal(point.clone()).add(dragOffset.current)
    const limitX = logo.surface === 'boxing-ring' ? 2.7 : logo.surface === 'mma-cage' ? 3.8 : room.width / 2 - 0.5
    const limitZ = logo.surface === 'boxing-ring' ? 2.7 : logo.surface === 'mma-cage' ? 3.8 : room.depth / 2 - 0.5
    updatePlacedLogo(logo.id, {
      u: THREE.MathUtils.clamp(localPoint.x, -limitX, limitX),
      v: THREE.MathUtils.clamp(localPoint.z, -limitZ, limitZ),
    })
    dispatchInteraction({ type: 'drag-threshold', pointerId: event.pointerId })
    invalidate()
  }

  const finishDrag = (event: ThreeEvent<PointerEvent>) => {
    if (draggingPointer.current !== event.pointerId) return
    event.stopPropagation()
    draggingPointer.current = null
    dispatchInteraction({ type: 'complete' })
    const target = event.target as Element
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }

  const selected = selectedLogoId === logo.id
  return (
    <group ref={groupRef} position={[logo.u, 0, logo.v]} rotation={[0, logo.rotation, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <LogoMark dataUrl={logo.dataUrl} size={logo.size} height={height} />
      {selected && <Line points={[[-logo.size / 2, height + 0.008, -logo.size / 2], [logo.size / 2, height + 0.008, -logo.size / 2], [logo.size / 2, height + 0.008, logo.size / 2], [-logo.size / 2, height + 0.008, logo.size / 2], [-logo.size / 2, height + 0.008, -logo.size / 2]]} color={ACCENT} lineWidth={2} />}
    </group>
  )
}

function WallPlacedLogo({ logo, room }: { logo: PlacedLogo; room: { width: number; depth: number } }) {
  const setSelectedLogoId = useGymStore((state) => state.setSelectedLogoId)
  const selectedLogoId = useGymStore((state) => state.selectedLogoId)
  const updatePlacedLogo = useGymStore((state) => state.updatePlacedLogo)
  const roomHeight = useGymStore((state) => state.design.room.height)
  const dispatchInteraction = useGymStore((state) => state.dispatchInteraction)
  const invalidate = useThree((state) => state.invalidate)
  const draggingPointer = useRef<number | null>(null)
  const north = logo.surface === 'wall-north'
  const position: THREE.Vector3Tuple = north ? [logo.u, logo.v, -room.depth / 2 + 0.095] : [-room.width / 2 + 0.095, logo.v, logo.u]
  const wallPlane = useMemo(() => north
    ? new THREE.Plane(new THREE.Vector3(0, 0, 1), room.depth / 2 - 0.095)
    : new THREE.Plane(new THREE.Vector3(1, 0, 0), room.width / 2 - 0.095), [north, room.depth, room.width])

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setSelectedLogoId(logo.id)
    draggingPointer.current = event.pointerId
    dispatchInteraction({ type: 'pointer-down', objectId: logo.id, pointerId: event.pointerId })
    ;(event.target as Element).setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (draggingPointer.current !== event.pointerId) return
    event.stopPropagation()
    const point = event.ray.intersectPlane(wallPlane, new THREE.Vector3())
    if (!point) return
    const horizontalLimit = (north ? room.width : room.depth) / 2 - 0.5
    updatePlacedLogo(logo.id, {
      u: THREE.MathUtils.clamp(north ? point.x : point.z, -horizontalLimit, horizontalLimit),
      v: THREE.MathUtils.clamp(point.y, 0.3, roomHeight - 0.3),
    })
    dispatchInteraction({ type: 'drag-threshold', pointerId: event.pointerId })
    invalidate()
  }

  const finishDrag = (event: ThreeEvent<PointerEvent>) => {
    if (draggingPointer.current !== event.pointerId) return
    event.stopPropagation()
    draggingPointer.current = null
    dispatchInteraction({ type: 'complete' })
    const target = event.target as Element
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }

  return (
    <group onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <VerticalLogoMark dataUrl={logo.dataUrl} maxWidth={logo.size} maxHeight={logo.size} position={position} rotation={north ? 0 : Math.PI / 2} roll={logo.rotation} />
      {selectedLogoId === logo.id && <mesh position={position} rotation={[0, north ? 0 : Math.PI / 2, logo.rotation]} renderOrder={7}><planeGeometry args={[logo.size + 0.08, logo.size + 0.08]} /><meshBasicMaterial color={ACCENT} wireframe depthTest={false} /></mesh>}
    </group>
  )
}

function TatamiSurface({ width, depth, primary, border }: { width: number; depth: number; primary: string; border: string }) {
  const inset = Math.min(1, width / 3, depth / 3)
  const innerWidth = Math.max(0.1, width - inset * 2)
  const innerDepth = Math.max(0.1, depth - inset * 2)
  const seamColor = new THREE.Color(border).multiplyScalar(0.62)

  return (
    <group position={[0, 0.025, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.05, depth]} />
        <meshStandardMaterial color={border} roughness={0.94} bumpMap={EVA_BUMP_TEXTURE} bumpScale={0.006} />
      </mesh>
      <mesh position={[0, 0.027, 0]} receiveShadow>
        <boxGeometry args={[innerWidth, 0.018, innerDepth]} />
        <meshStandardMaterial color={primary} roughness={0.93} bumpMap={EVA_BUMP_TEXTURE} bumpScale={0.008} />
      </mesh>
      <gridHelper
        args={[Math.max(width, depth), Math.ceil(Math.max(width, depth)), seamColor, seamColor]}
        position={[0, 0.038, 0]}
        material-transparent
        material-opacity={0.16}
      />
    </group>
  )
}

function Room() {
  const room = useGymStore((state) => state.design.room)
  const wallsVisible = useGymStore((state) => state.design.wallsVisible)
  const placedLogos = useGymStore((state) => state.design.placedLogos) ?? []
  const floor = useGymStore((state) => state.design.floor) ?? { primary: 'black' as const, border: 'blue' as const }

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color="#0e1211" roughness={0.98} />
      </mesh>
      <TatamiSurface
        width={room.width}
        depth={room.depth}
        primary={FLOOR_COLORS[floor.primary]}
        border={FLOOR_COLORS[floor.border]}
      />
      {placedLogos.filter((logo) => logo.surface === 'floor').map((logo) => <HorizontalPlacedLogo key={logo.id} logo={logo} height={0.072} />)}
      {wallsVisible && (
        <>
          <mesh position={[0, room.height / 2, -room.depth / 2]} receiveShadow castShadow>
            <boxGeometry args={[room.width, room.height, 0.18]} />
            <meshStandardMaterial color="#dfe3e1" roughness={0.78} />
          </mesh>
          <mesh position={[-room.width / 2, room.height / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.18, room.height, room.depth]} />
            <meshStandardMaterial color="#d9dedb" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.06, -room.depth / 2 + 0.102]} castShadow receiveShadow>
            <boxGeometry args={[room.width - 0.18, 0.12, 0.026]} />
            <meshStandardMaterial color="#4d5753" roughness={0.58} bumpMap={POWDER_COAT_BUMP_TEXTURE} bumpScale={0.002} />
          </mesh>
          <mesh position={[-room.width / 2 + 0.102, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.026, 0.12, room.depth - 0.18]} />
            <meshStandardMaterial color="#4d5753" roughness={0.58} bumpMap={POWDER_COAT_BUMP_TEXTURE} bumpScale={0.002} />
          </mesh>
          <Bar from={[-room.width / 2 + 0.1, 0, -room.depth / 2 + 0.1]} to={[-room.width / 2 + 0.1, room.height, -room.depth / 2 + 0.1]} radius={0.065} color="#69736f" />
          <Bar from={[room.width / 2 - 0.1, 0, -room.depth / 2 + 0.1]} to={[room.width / 2 - 0.1, room.height, -room.depth / 2 + 0.1]} radius={0.065} color="#69736f" />
          <Bar from={[-room.width / 2 + 0.1, 0, room.depth / 2 - 0.1]} to={[-room.width / 2 + 0.1, room.height, room.depth / 2 - 0.1]} radius={0.065} color="#69736f" />
          {placedLogos.filter((logo) => logo.surface === 'wall-north' || logo.surface === 'wall-west').map((logo) => <WallPlacedLogo key={logo.id} logo={logo} room={room} />)}
        </>
      )}
      {wallsVisible && <ArchitecturalElements width={room.width} depth={room.depth} height={room.height} />}
      <DimensionLine width={room.width} depth={room.depth} />
    </group>
  )
}

function DimensionLine({ width, depth }: { width: number; depth: number }) {
  return (
    <group position={[0, 0.04, 0]}>
      <Line points={[[-width / 2, 0, depth / 2 + 0.45], [width / 2, 0, depth / 2 + 0.45]]} color={ACCENT} lineWidth={1.5} />
      <Line points={[[width / 2 + 0.45, 0, -depth / 2], [width / 2 + 0.45, 0, depth / 2]]} color={ACCENT} lineWidth={1.5} />
      <Html position={[0, 0.04, depth / 2 + 0.48]} center transform distanceFactor={14}>
        <span className="dimension-label">{width.toFixed(1)} m</span>
      </Html>
      <Html position={[width / 2 + 0.48, 0.04, 0]} center transform distanceFactor={14}>
        <span className="dimension-label">{depth.toFixed(1)} m</span>
      </Html>
    </group>
  )
}

function Bar({ from, to, radius = 0.025, color = STEEL }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; radius?: number; color?: string }) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length: direction.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    }
  }, [from, to])

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} metalness={0.45} roughness={0.38} />
    </mesh>
  )
}

function WebbingStrap({ from, to, width = 0.042 }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; width?: number }) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length: direction.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    }
  }, [from, to])

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow>
      <boxGeometry args={[width, length, 0.007]} />
      <meshStandardMaterial color="#111412" roughness={0.82} metalness={0} />
    </mesh>
  )
}

function SquareBeam({ from, to, size = 0.065, color = '#171c1a' }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; size?: number; color?: string }) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length: direction.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    }
  }, [from, to])

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow receiveShadow>
      <boxGeometry args={[size, length, size]} />
      <meshPhysicalMaterial color={color} metalness={0.58} roughness={0.36} clearcoat={0.08} clearcoatRoughness={0.54} bumpMap={POWDER_COAT_BUMP_TEXTURE} bumpScale={0.0025} />
    </mesh>
  )
}

function AnchorPlate({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, 0.025, z]} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.05, 0.14]} />
        <meshStandardMaterial color="#111513" metalness={0.62} roughness={0.36} />
      </mesh>
      {[-0.07, 0.07].map((offset) => <mesh key={offset} position={[offset, 0.032, 0]}><cylinderGeometry args={[0.012, 0.012, 0.012, 12]} /><meshStandardMaterial color="#858d89" metalness={0.8} /></mesh>)}
    </group>
  )
}

function BeamGusset({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 2.31, z]} castShadow receiveShadow>
      <boxGeometry args={[0.24, 0.22, 0.018]} />
      <meshStandardMaterial color="#252c29" metalness={0.58} roughness={0.34} />
    </mesh>
  )
}

function RingRope({ from, to, height, color }: { from: [number, number]; to: [number, number]; height: number; color: string }) {
  const curve = useMemo(() => {
    const direction = new THREE.Vector2(to[0] - from[0], to[1] - from[1])
    const normal = new THREE.Vector2(-direction.y, direction.x).normalize().multiplyScalar(0.018)
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(from[0], height, from[1]),
      new THREE.Vector3(from[0] + direction.x * 0.33 + normal.x, height - 0.012, from[1] + direction.y * 0.33 + normal.y),
      new THREE.Vector3(from[0] + direction.x * 0.67 + normal.x, height - 0.012, from[1] + direction.y * 0.67 + normal.y),
      new THREE.Vector3(to[0], height, to[1]),
    ])
  }, [from, height, to])

  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 48, 0.027, 12, false]} />
      <meshStandardMaterial color={color} roughness={0.68} bumpMap={CANVAS_BUMP_TEXTURE} bumpScale={0.0035} />
    </mesh>
  )
}

function RingTurnbuckle({ x, z, height, rotation }: { x: number; z: number; height: number; rotation: number }) {
  return (
    <group position={[x, height, z]} rotation={[0, rotation, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.28, 10]} />
        <meshStandardMaterial color="#8c9490" metalness={0.78} roughness={0.24} />
      </mesh>
      <mesh position={[0.02, 0, 0]} castShadow>
        <boxGeometry args={[0.23, 0.105, 0.09]} />
        <meshStandardMaterial color="#202624" roughness={0.48} />
      </mesh>
    </group>
  )
}

function FloorLogoZones({ logos, height, span }: { logos: EquipmentCustomization['logos']; height: number; span: number }) {
  if (!logos) return null
  return (
    <group>
      {logos.center && <LogoMark dataUrl={logos.center} size={span * 0.32} height={height} />}
    </group>
  )
}

function RingApronLogos({ dataUrl }: { dataUrl?: string }) {
  if (!dataUrl) return null
  const offsets = [-2.7, -0.9, 0.9, 2.7]
  const placements = offsets.flatMap((offset) => [
    { position: [offset, 0.91, 3.913] as THREE.Vector3Tuple, rotation: 0 },
    { position: [3.913, 0.91, -offset] as THREE.Vector3Tuple, rotation: Math.PI / 2 },
    { position: [-offset, 0.91, -3.913] as THREE.Vector3Tuple, rotation: Math.PI },
    { position: [-3.913, 0.91, offset] as THREE.Vector3Tuple, rotation: -Math.PI / 2 },
  ])
  return <>{placements.map((placement, index) => <VerticalLogoMark key={`ring-apron-${index}`} dataUrl={dataUrl} maxWidth={1.35} maxHeight={0.34} {...placement} />)}</>
}

function CageApronLogos({ dataUrl, radius }: { dataUrl?: string; radius: number }) {
  if (!dataUrl) return null
  return <>{Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4
    return <VerticalLogoMark key={`cage-apron-${index}`} dataUrl={dataUrl} maxWidth={1.45} maxHeight={0.46} position={[Math.cos(angle) * (radius + 0.012), 0.53, Math.sin(angle) * (radius + 0.012)]} rotation={Math.PI / 2 - angle} />
  })}</>
}

function BoxingRing({ item }: { item: PlacedEquipment }) {
  const placedLogos = useGymStore((state) => state.design.placedLogos) ?? []
  const platformSize = 7.8
  const ropeHalfSpan = 3.05
  const postHalfSpan = 3.22
  const ropeHeights = [1.4, 1.7, 2, 2.3]
  const ropeCorners: Array<[number, number]> = [[-ropeHalfSpan, -ropeHalfSpan], [ropeHalfSpan, -ropeHalfSpan], [ropeHalfSpan, ropeHalfSpan], [-ropeHalfSpan, ropeHalfSpan]]
  const postCorners: Array<[number, number]> = [[-postHalfSpan, -postHalfSpan], [postHalfSpan, -postHalfSpan], [postHalfSpan, postHalfSpan], [-postHalfSpan, postHalfSpan]]

  return (
    <group>
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[platformSize, 0.92, platformSize]} />
        <meshStandardMaterial color="#1b211f" roughness={0.76} metalness={0.08} />
      </mesh>
      {[-3.45, -1.15, 1.15, 3.45].flatMap((offset) => [
        <SquareBeam key={`frame-x-${offset}`} from={[-3.78, 0.16, offset]} to={[3.78, 0.16, offset]} size={0.09} color="#3f4844" />,
        <SquareBeam key={`frame-z-${offset}`} from={[offset, 0.16, -3.78]} to={[offset, 0.16, 3.78]} size={0.09} color="#3f4844" />,
      ])}
      <mesh position={[0, 0.955, 0]} receiveShadow>
        <boxGeometry args={[7.72, 0.09, 7.72]} />
        <meshStandardMaterial color={FLOOR_COLORS[item.customization?.surfaceColor ?? 'gray']} roughness={0.86} bumpMap={CANVAS_BUMP_TEXTURE} bumpScale={0.012} />
      </mesh>
      <mesh position={[0, 0.91, 3.895]} receiveShadow><boxGeometry args={[7.8, 0.82, 0.03]} /><meshStandardMaterial color="#242b28" roughness={0.7} /></mesh>
      <mesh position={[0, 0.91, -3.895]} receiveShadow><boxGeometry args={[7.8, 0.82, 0.03]} /><meshStandardMaterial color="#242b28" roughness={0.7} /></mesh>
      <mesh position={[3.895, 0.91, 0]} receiveShadow><boxGeometry args={[0.03, 0.82, 7.8]} /><meshStandardMaterial color="#242b28" roughness={0.7} /></mesh>
      <mesh position={[-3.895, 0.91, 0]} receiveShadow><boxGeometry args={[0.03, 0.82, 7.8]} /><meshStandardMaterial color="#242b28" roughness={0.7} /></mesh>
      <RingApronLogos dataUrl={item.customization?.logos?.sides} />
      {postCorners.map(([x, z], index) => <SquareBeam key={`ring-post-${index}`} from={[x, 0.08, z]} to={[x, 2.42, z]} size={0.13} color="#39423e" />)}
      {ropeHeights.flatMap((height, ropeIndex) => ropeCorners.map((corner, index) => (
        <RingRope key={`rope-${ropeIndex}-${index}`} from={corner} to={ropeCorners[(index + 1) % 4]} height={height} color={ropeIndex < 2 ? '#e8e7df' : '#ba3c35'} />
      )))}
      {postCorners.flatMap(([x, z], cornerIndex) => ropeHeights.map((height, ropeIndex) => {
        const towardCenter = Math.atan2(-z, -x)
        return <RingTurnbuckle key={`turnbuckle-${cornerIndex}-${ropeIndex}`} x={x + Math.cos(towardCenter) * 0.12} z={z + Math.sin(towardCenter) * 0.12} height={height} rotation={-towardCenter} />
      }))}
      {postCorners.map(([x, z], index) => (
        <group key={`corner-pad-${index}`} position={[x + Math.sign(-x) * 0.09, 1.85, z + Math.sign(-z) * 0.09]} rotation={[0, Math.atan2(-x, -z), 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.36, 1.12, 0.16]} />
            <meshStandardMaterial color={index === 0 ? '#b83c35' : index === 2 ? '#365e86' : '#e4e3dc'} roughness={0.55} />
          </mesh>
          {item.customization?.logos?.corners && [-0.36, 0, 0.36].map((offsetY, logoIndex) => <VerticalLogoMark key={`corner-pad-logo-${logoIndex}`} dataUrl={item.customization?.logos?.corners as string} maxWidth={0.27} maxHeight={0.25} position={[0, offsetY, 0.086]} rotation={0} />)}
        </group>
      ))}
      {[0, 1].flatMap((separatorIndex) => [0, 1, 2, 3].map((side) => {
        const y = separatorIndex === 0 ? 1.54 : 2.16
        const horizontal = side % 2 === 0
        const coordinate = side < 2 ? -3.07 : 3.07
        return <mesh key={`separator-${separatorIndex}-${side}`} position={horizontal ? [0, y, coordinate] : [coordinate, y, 0]} castShadow><boxGeometry args={horizontal ? [0.055, 0.82, 0.035] : [0.035, 0.82, 0.055]} /><meshStandardMaterial color="#e1e0d9" roughness={0.7} /></mesh>
      }))}
      <group position={[0, 0, 4.28]}>
        {[0.16, 0.43, 0.7].map((height, index) => <mesh key={height} position={[0, height / 2, index * -0.25]} castShadow receiveShadow><boxGeometry args={[1.05, height, 0.52]} /><meshStandardMaterial color="#3a423f" metalness={0.3} roughness={0.5} /></mesh>)}
      </group>
      <FloorLogoZones logos={item.customization?.logos} height={1.006} span={6.1} />
      {placedLogos.filter((logo) => logo.surface === 'boxing-ring' && logo.targetId === item.id).map((logo) => <HorizontalPlacedLogo key={logo.id} logo={logo} height={1.012} />)}
    </group>
  )
}

function createDiamondMeshGeometry(width: number, height: number) {
  const positions: number[] = []
  const spacing = 0.18
  const halfWidth = width / 2
  const halfHeight = height / 2
  for (let intercept = -halfWidth - halfHeight; intercept <= halfWidth + halfHeight; intercept += spacing) {
    const risingStart = Math.max(-halfWidth, -halfHeight - intercept)
    const risingEnd = Math.min(halfWidth, halfHeight - intercept)
    if (risingStart < risingEnd) positions.push(risingStart, risingStart + intercept, 0, risingEnd, risingEnd + intercept, 0)

    const fallingStart = Math.max(-halfWidth, intercept - halfHeight)
    const fallingEnd = Math.min(halfWidth, intercept + halfHeight)
    if (fallingStart < fallingEnd) positions.push(fallingStart, -fallingStart + intercept, 0, fallingEnd, -fallingEnd + intercept, 0)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

function CageMeshPanel({ width, height }: { width: number; height: number }) {
  const geometry = useMemo(() => createDiamondMeshGeometry(width, height), [height, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry} renderOrder={3}>
      <lineBasicMaterial color="#59615e" transparent opacity={0.72} depthWrite={false} />
    </lineSegments>
  )
}

function MmaCage({ item }: { item: PlacedEquipment }) {
  const placedLogos = useGymStore((state) => state.design.placedLogos) ?? []
  const innerAcrossFlats = 9
  const outerAcrossFlats = 11
  const innerApothem = innerAcrossFlats / 2
  const innerRadius = innerApothem / Math.cos(Math.PI / 8)
  const outerRadius = outerAcrossFlats / 2 / Math.cos(Math.PI / 8)
  const platformHeight = 1
  const fenceHeight = 1.95
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + index * Math.PI / 4
    return [Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius] as [number, number]
  })

  return (
    <group>
      <mesh position={[0, platformHeight / 2, 0]} receiveShadow castShadow rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[outerRadius, outerRadius, platformHeight, 8]} />
        <meshStandardMaterial color="#222927" roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, platformHeight + 0.026, 0]} receiveShadow rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[innerRadius - 0.05, innerRadius - 0.05, 0.052, 8]} />
        <meshStandardMaterial color={FLOOR_COLORS[item.customization?.surfaceColor ?? 'gray']} roughness={0.92} />
      </mesh>
      <CageApronLogos dataUrl={item.customization?.logos?.sides} radius={outerRadius} />
      {points.map(([x, z], index) => {
        const next = points[(index + 1) % points.length]
        const midpointX = (x + next[0]) / 2
        const midpointZ = (z + next[1]) / 2
        const sideLength = Math.hypot(next[0] - x, next[1] - z)
        const angle = Math.atan2(next[1] - z, next[0] - x)
        const panelY = platformHeight + fenceHeight / 2
        const isDoor = index === 1
        return (
          <group key={`cage-side-${index}`}>
            <SquareBeam from={[x, 0.08, z]} to={[x, platformHeight + fenceHeight + 0.08, z]} size={0.12} color="#252c29" />
            <Bar from={[x, platformHeight + 0.08, z]} to={[next[0], platformHeight + 0.08, next[1]]} radius={0.055} color="#343c39" />
            <Bar from={[x, platformHeight + fenceHeight, z]} to={[next[0], platformHeight + fenceHeight, next[1]]} radius={0.075} color="#1f2623" />
            <group position={[midpointX, panelY, midpointZ]} rotation={[0, -angle, 0]}>
              {isDoor ? (
                <group>
                  <group position={[-(sideLength + 1.02) / 4, 0, 0]}><CageMeshPanel width={(sideLength - 1.02) / 2} height={fenceHeight - 0.2} /></group>
                  <group position={[(sideLength + 1.02) / 4, 0, 0]}><CageMeshPanel width={(sideLength - 1.02) / 2} height={fenceHeight - 0.2} /></group>
                  <group position={[0, 0, -0.035]}>
                    <CageMeshPanel width={0.92} height={fenceHeight - 0.3} />
                    <Bar from={[-0.51, -fenceHeight / 2 + 0.1, 0]} to={[-0.51, fenceHeight / 2 - 0.1, 0]} radius={0.026} color="#838b87" />
                    <Bar from={[0.51, -fenceHeight / 2 + 0.1, 0]} to={[0.51, fenceHeight / 2 - 0.1, 0]} radius={0.026} color="#838b87" />
                    <Bar from={[-0.51, fenceHeight / 2 - 0.1, 0]} to={[0.51, fenceHeight / 2 - 0.1, 0]} radius={0.026} color="#838b87" />
                    <Bar from={[-0.51, -fenceHeight / 2 + 0.1, 0]} to={[0.51, -fenceHeight / 2 + 0.1, 0]} radius={0.026} color="#838b87" />
                  </group>
                  {[-0.46, 0.46].map((y) => <mesh key={y} position={[-0.56, y, -0.065]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.045, 0.012, 8, 18]} /><meshStandardMaterial color="#8b938f" metalness={0.78} roughness={0.25} /></mesh>)}
                  <mesh position={[0.39, 0.08, -0.09]} castShadow><boxGeometry args={[0.22, 0.07, 0.1]} /><meshStandardMaterial color="#a3aaa6" metalness={0.72} roughness={0.28} /></mesh>
                </group>
              ) : <CageMeshPanel width={sideLength - 0.08} height={fenceHeight - 0.18} />}
            </group>
          </group>
        )
      })}
      {points.map(([x, z], index) => (
        <group key={`cage-pad-${index}`}>
          <mesh position={[x, platformHeight + fenceHeight / 2, z]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, fenceHeight, 8]} />
            <meshStandardMaterial color={index % 2 ? '#303936' : '#3d4743'} roughness={0.5} />
          </mesh>
          {item.customization?.logos?.corners && [-0.42, 0, 0.42].map((offsetY, logoIndex) => <VerticalLogoMark key={`cage-post-logo-${logoIndex}`} dataUrl={item.customization?.logos?.corners as string} maxWidth={0.18} maxHeight={0.25} position={[x + Math.sign(-x) * 0.14, platformHeight + fenceHeight / 2 + offsetY, z + Math.sign(-z) * 0.14]} rotation={Math.atan2(-x, -z)} />)}
        </group>
      ))}
      <group>
        {[
          { height: 0.74, z: 5.72 },
          { height: 0.46, z: 6.03 },
          { height: 0.18, z: 6.34 },
        ].map(({ height, z }) => <mesh key={height} position={[0, height / 2, z]} castShadow receiveShadow><boxGeometry args={[1.05, height, 0.62]} /><meshStandardMaterial color="#3b4440" metalness={0.3} roughness={0.5} /></mesh>)}
      </group>
      <FloorLogoZones logos={item.customization?.logos} height={1.058} span={9} />
      {placedLogos.filter((logo) => logo.surface === 'mma-cage' && logo.targetId === item.id).map((logo) => <HorizontalPlacedLogo key={logo.id} logo={logo} height={1.064} />)}
    </group>
  )
}

function normalizedProfileRadiusAt(profile: Array<[number, number]>, level: number) {
  const upperIndex = profile.findIndex(([, vertical]) => vertical >= level)
  if (upperIndex <= 0) return profile[Math.max(0, upperIndex)]?.[0] ?? 0
  const [lowerRadius, lowerY] = profile[upperIndex - 1]
  const [upperRadius, upperY] = profile[upperIndex]
  const progress = (level - lowerY) / (upperY - lowerY)
  return THREE.MathUtils.lerp(lowerRadius, upperRadius, progress)
}

function teardropBagProfile(): Array<[number, number]> {
  return [[.12, 0], [.4, .018], [.7, .065], [.9, .14], [1, .25], [1, .45], [.94, .6], [.79, .73], [.6, .84], [.42, .92], [.28, .975], [.22, 1]]
}

function HeavyBag({ kind }: { kind: 'heavy-bag' | 'banana-bag' | 'banana-bag-xl' | 'teardrop-bag' }) {
  const definition = EQUIPMENT[kind]
  const height = definition.dimensions[2]
  const radius = definition.dimensions[0] / 2
  const bottomY = kind === 'heavy-bag' ? 0.34 : kind === 'teardrop-bag' ? 0.52 : 0.08
  const topY = bottomY + height
  const strapRingY = topY + 0.2
  const profile: Array<[number, number]> = kind === 'teardrop-bag'
    ? teardropBagProfile()
    : kind === 'heavy-bag'
      ? [[0, 0], [.88, .005], [.98, .022], [1, .06], [1, .91], [.97, .95], [.82, .982], [0, 1]]
      : [[0, 0], [.91, .003], [.985, .014], [1, .038], [.998, .96], [.96, .982], [.8, .996], [0, 1]]
  const lathePoints = profile.map(([radial, vertical]) => new THREE.Vector2(radius * radial, height * vertical))
  const strapLevel = .94
  const strapY = bottomY + height * strapLevel
  const strapRadius = radius * normalizedProfileRadiusAt(profile, strapLevel) * .96

  return (
    <group>
      <SquareBeam from={[0, 0.06, 0.7]} to={[0, 2.82, 0.7]} size={0.085} />
      <SquareBeam from={[0, 2.78, 0.7]} to={[0, 2.78, 0]} size={0.085} />
      <SquareBeam from={[0, 0.06, 0.72]} to={[0, 0.06, -0.85]} size={0.075} />
      <SquareBeam from={[-0.72, 0.06, 0.7]} to={[0.72, 0.06, 0.7]} size={0.075} />
      <SquareBeam from={[-0.62, 0.07, 0.7]} to={[0, 1.34, 0.7]} size={0.052} color="#252c29" />
      <SquareBeam from={[0.62, 0.07, 0.7]} to={[0, 1.34, 0.7]} size={0.052} color="#252c29" />
      <AnchorPlate x={0} z={-0.84} rotation={Math.PI / 2} />
      <AnchorPlate x={-0.7} z={0.7} />
      <AnchorPlate x={0.7} z={0.7} />
      <mesh position={[0, 2.75, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.05, 18]} />
        <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.28} />
      </mesh>
      <Chain x={0} top={2.72} bottom={strapRingY + 0.04} />
      {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((angle) => (
        <group key={angle}>
          <WebbingStrap from={[Math.cos(angle) * strapRadius, strapY, Math.sin(angle) * strapRadius]} to={[0, strapRingY, 0]} />
          <mesh position={[Math.cos(angle) * strapRadius, strapY, Math.sin(angle) * strapRadius]} rotation={[0, angle, 0]} castShadow>
            <torusGeometry args={[0.026, 0.006, 8, 20]} />
            <meshStandardMaterial color="#686f6c" roughness={0.3} metalness={0.72} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, strapRingY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.048, 0.011, 9, 28]} />
        <meshStandardMaterial color="#737b78" roughness={0.3} metalness={0.74} />
      </mesh>
      <mesh position={[0, bottomY, 0]} castShadow receiveShadow>
        <latheGeometry args={[lathePoints, 64]} />
        <meshPhysicalMaterial color="#090b0a" roughness={0.5} metalness={0} clearcoat={0.2} clearcoatRoughness={0.46} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.006} />
      </mesh>
      {(kind === 'teardrop-bag' ? [.07, .91] : [.06, .92]).map((level) => (
        <mesh key={level} position={[0, bottomY + height * level, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[radius * normalizedProfileRadiusAt(profile, level) + .0015, 0.003, 7, 56]} />
          <meshStandardMaterial color="#272b29" roughness={0.66} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, index) => {
        const angle = index * Math.PI / 3
        const seamPath = new THREE.CatmullRomCurve3(profile.slice(1, -1).map(([radial, vertical]) => new THREE.Vector3(
          Math.cos(angle) * (radius * radial + .0015),
          bottomY + height * vertical,
          Math.sin(angle) * (radius * radial + .0015),
        )))
        return <mesh key={angle}><tubeGeometry args={[seamPath, 36, .0022, 5, false]} /><meshStandardMaterial color="#202321" roughness={.72} /></mesh>
      })}
    </group>
  )
}

function doubleEndProfile(radius: number, height: number) {
  return [
    [radius * .1, 0],
    [radius * .28, height * .035],
    [radius * .62, height * .12],
    [radius * .88, height * .25],
    [radius, height * .43],
    [radius * .98, height * .57],
    [radius * .88, height * .75],
    [radius * .62, height * .88],
    [radius * .28, height * .965],
    [radius * .1, height],
  ].map(([radial, vertical]) => new THREE.Vector2(radial, vertical))
}

function DoubleEndBagBody({ diameter, height, bottomY, selected = false }: { diameter: number; height: number; bottomY: number; selected?: boolean }) {
  const radius = diameter / 2
  const bladderHeight = Math.min(height, diameter * 1.12)
  const bladderBottomY = bottomY + (height - bladderHeight) / 2
  const profile = doubleEndProfile(radius, bladderHeight)

  return (
    <group>
      <mesh position={[0, bladderBottomY, 0]} castShadow receiveShadow>
        <latheGeometry args={[profile, 64]} />
        <meshPhysicalMaterial color="#111513" roughness={.48} metalness={0} clearcoat={.16} clearcoatRoughness={.52} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={.006} emissive={selected ? ACCENT : '#000000'} emissiveIntensity={selected ? .16 : 0} />
      </mesh>
      {[0, bladderHeight].map((vertical, index) => <group key={vertical} position={[0, bladderBottomY + vertical, 0]}>
        <mesh castShadow><cylinderGeometry args={[radius * .12, radius * .16, .03, 20]} /><meshStandardMaterial color="#191d1b" roughness={.62} /></mesh>
        <mesh position={[0, index === 0 ? -.026 : .026, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[.012, .0032, 7, 20]} /><meshStandardMaterial color="#343a37" roughness={.48} metalness={.18} /></mesh>
      </group>)}
      {bladderBottomY > bottomY && <Bar from={[0, bottomY, 0]} to={[0, bladderBottomY - .025, 0]} radius={.0055} color="#171b19" />}
      {bladderBottomY + bladderHeight < bottomY + height && <Bar from={[0, bladderBottomY + bladderHeight + .025, 0]} to={[0, bottomY + height, 0]} radius={.0055} color="#171b19" />}
      <mesh position={[0, bladderBottomY + bladderHeight * .5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[radius * .995, .0028, 7, 56]} /><meshStandardMaterial color="#2b302e" roughness={.68} /></mesh>
      {Array.from({ length: 4 }, (_, index) => {
        const angle = index * Math.PI / 2
        const seamPath = new THREE.CatmullRomCurve3(profile.slice(1, -1).map((point) => new THREE.Vector3(
          Math.cos(angle) * (point.x + .001),
          bladderBottomY + point.y,
          Math.sin(angle) * (point.x + .001),
        )))
        return <mesh key={angle}><tubeGeometry args={[seamPath, 28, .0012, 5, false]} /><meshStandardMaterial color="#292e2b" roughness={.72} /></mesh>
      })}
    </group>
  )
}

function DoubleEndBag({ kind }: { kind: 'double-end-25x18' | 'double-end-30x20' | 'double-end-35x22' }) {
  const [diameter, , height] = EQUIPMENT[kind].dimensions
  const centerY = 1.45
  const bottomY = centerY - height / 2
  const lowerTip = bottomY - .03
  const upperTip = bottomY + height + .03

  return (
    <group>
      <Bar from={[0, 0.12, 0]} to={[0, lowerTip - .026, 0]} radius={0.0045} color="#171b19" />
      <Bar from={[0, upperTip + .026, 0]} to={[0, 2.94, 0]} radius={0.0045} color="#171b19" />
      <mesh position={[0, 0.032, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.082, 0.064, 24]} />
        <meshStandardMaterial color="#4f5754" metalness={0.66} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.096, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.024, 0.005, 8, 22]} />
        <meshStandardMaterial color="#727a77" metalness={0.8} roughness={0.22} />
      </mesh>
      <mesh position={[0, 2.975, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.05, 24]} />
        <meshStandardMaterial color="#4f5754" metalness={0.66} roughness={0.3} />
      </mesh>
      <DoubleEndBagBody diameter={diameter} height={height} bottomY={bottomY} />
    </group>
  )
}

function speedBagProfile(radius: number, height: number) {
  return [
    [radius * .07, 0],
    [radius * .36, height * .03],
    [radius * .72, height * .11],
    [radius * .94, height * .23],
    [radius, height * .38],
    [radius * .96, height * .53],
    [radius * .82, height * .67],
    [radius * .62, height * .79],
    [radius * .4, height * .89],
    [radius * .22, height * .97],
    [radius * .15, height],
  ].map(([x, y]) => new THREE.Vector2(x, y))
}

function SpeedBag({ kind }: { kind: 'speed-bag-18x13' | 'speed-bag-20x15' | 'speed-bag-23x18' | 'speed-bag-25x20' | 'speed-bag-28x22' }) {
  const [diameter, , height] = EQUIPMENT[kind].dimensions
  const radius = diameter / 2
  const topY = 2.35
  const profile = speedBagProfile(radius, height)
  const bottomY = topY - height

  return (
    <group>
      <SquareBeam from={[0, 1.72, 0.54]} to={[0, 2.7, 0.54]} size={0.075} />
      <SquareBeam from={[0, 2.56, 0.54]} to={[0, 2.56, 0.12]} size={0.065} />
      <SquareBeam from={[-0.2, 2.56, 0.18]} to={[-0.2, topY + 0.16, 0.18]} size={0.025} color="#9ba29f" />
      <SquareBeam from={[0.2, 2.56, 0.18]} to={[0.2, topY + 0.16, 0.18]} size={0.025} color="#9ba29f" />
      {[1.86, 2.52].map((y) => <mesh key={y} position={[0, y, 0.575]} castShadow><boxGeometry args={[0.48, 0.09, 0.035]} /><meshStandardMaterial color="#202624" metalness={0.45} roughness={0.38} /></mesh>)}
      <mesh position={[0, topY + 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.08, 40]} />
        <meshStandardMaterial color="#242826" roughness={0.46} metalness={0.32} />
      </mesh>
      <mesh position={[0, topY + .055, 0]} castShadow>
        <cylinderGeometry args={[.018, .018, .055, 18]} />
        <meshStandardMaterial color="#747c79" roughness={.24} metalness={.8} />
      </mesh>
      <mesh position={[0, topY + .018, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[.022, .006, 8, 20]} />
        <meshStandardMaterial color="#747c79" roughness={.24} metalness={.8} />
      </mesh>
      <mesh position={[0, bottomY, 0]} castShadow receiveShadow>
        <latheGeometry args={[profile, 56]} />
        <meshPhysicalMaterial color="#111513" roughness={0.48} metalness={0} clearcoat={0.18} clearcoatRoughness={0.5} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.006} />
      </mesh>
      <mesh position={[0, topY + .002, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[radius * .105, .0025, 7, 24]} />
        <meshStandardMaterial color="#252a28" roughness={.64} />
      </mesh>
      <mesh position={[0, bottomY - .011, 0]} castShadow>
        <cylinderGeometry args={[radius * .1, radius * .07, .022, 14]} />
        <meshStandardMaterial color="#1d211f" roughness={0.62} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = index * Math.PI / 3
        const seamPath = new THREE.CatmullRomCurve3(profile.slice(1, -1).map((point) => new THREE.Vector3(
          Math.cos(angle) * (point.x + .0012),
          bottomY + point.y,
          Math.sin(angle) * (point.x + .0012),
        )))
        return <mesh key={angle}><tubeGeometry args={[seamPath, 30, .0013, 5, false]} /><meshStandardMaterial color="#424845" roughness={.72} /></mesh>
      })}
    </group>
  )
}

function Chain({ x, z = 0, top, bottom }: { x: number; z?: number; top: number; bottom: number }) {
  const links = Math.max(5, Math.ceil((top - bottom) / 0.04))
  return (
    <group>
      {Array.from({ length: links }, (_, index) => {
        const y = top - (index + 0.5) * ((top - bottom) / links)
        return (
          <mesh key={index} position={[x, y, z]} rotation={[0, index % 2 ? Math.PI / 2 : 0, 0]} castShadow>
            <torusGeometry args={[0.021, 0.0048, 7, 14]} />
            <meshStandardMaterial color="#737b78" metalness={0.82} roughness={0.25} />
          </mesh>
        )
      })}
    </group>
  )
}

function MountPoint({ station, selected, onSelect }: { station: RackStation; selected: boolean; onSelect: (event: ThreeEvent<MouseEvent>) => void }) {
  const [x, y, z] = station.localPosition
  const direction = station.mountType === 'double-end-bottom' ? 1 : -1
  return (
    <group position={[x, y, z]} rotation={[0, station.localRotation, 0]} onClick={onSelect}>
      <mesh position={[0, direction * 0.055, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.11, 16]} />
        <meshStandardMaterial color={selected ? ACCENT : '#7d8582'} metalness={0.78} roughness={0.25} />
      </mesh>
      <mesh position={[0, direction * 0.13, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.052, 0.011, 9, 24]} />
        <meshStandardMaterial color={selected ? ACCENT : '#737b78'} metalness={0.8} roughness={0.24} />
      </mesh>
      {!station.mountedEquipmentId && <mesh position={[0, direction * 0.13, 0]}><sphereGeometry args={[0.095, 16, 12]} /><meshBasicMaterial color={ACCENT} transparent opacity={selected ? 0.28 : 0.12} /></mesh>}
    </group>
  )
}

function TrolleyHousing({ station }: { station: RackStation }) {
  const [x, y, z] = station.localPosition
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, -0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.18, 0.16]} />
        <meshStandardMaterial color="#202624" metalness={0.62} roughness={0.3} />
      </mesh>
      {[-0.075, 0.075].map((offset) => <mesh key={offset} position={[offset, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.035, 14]} /><meshStandardMaterial color="#858d89" metalness={0.8} roughness={0.24} /></mesh>)}
    </group>
  )
}

function HumanScaleReference({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.675, 0]} scale={[0.92, 1.08, 0.9]} castShadow><sphereGeometry args={[0.116, 24, 18]} /><meshStandardMaterial color="#b98061" roughness={0.7} /></mesh>
      <mesh position={[0, 1.78, -0.025]} scale={[1, 0.45, 0.95]} castShadow><sphereGeometry args={[0.116, 20, 12]} /><meshStandardMaterial color="#262a28" roughness={0.9} /></mesh>
      <mesh position={[0, 1.62, 0]} castShadow><cylinderGeometry args={[0.052, 0.06, 0.11, 16]} /><meshStandardMaterial color="#b98061" roughness={0.7} /></mesh>
      <mesh position={[0, 1.35, 0]} scale={[1.18, 1, 0.72]} castShadow><capsuleGeometry args={[0.155, 0.34, 8, 20]} /><meshStandardMaterial color="#202725" roughness={0.78} /></mesh>
      <mesh position={[0, 1.06, 0]} scale={[1.05, 0.75, 0.82]} castShadow><capsuleGeometry args={[0.145, 0.13, 8, 18]} /><meshStandardMaterial color="#303a37" roughness={0.8} /></mesh>
      {[-1, 1].map((side) => (
        <group key={`arm-${side}`}>
          <mesh position={[side * 0.19, 1.47, 0]}><sphereGeometry args={[0.075, 14, 10]} /><meshStandardMaterial color="#202725" roughness={0.78} /></mesh>
          <Bar from={[side * 0.2, 1.45, 0]} to={[side * 0.27, 1.2, 0.015]} radius={0.052} color="#b98061" />
          <mesh position={[side * 0.275, 1.18, 0.015]}><sphereGeometry args={[0.052, 12, 9]} /><meshStandardMaterial color="#b98061" roughness={0.72} /></mesh>
          <Bar from={[side * 0.275, 1.16, 0.015]} to={[side * 0.3, 0.91, 0.035]} radius={0.043} color="#b98061" />
          <mesh position={[side * 0.3, 0.875, 0.05]} scale={[0.72, 1.2, 0.55]}><sphereGeometry args={[0.057, 12, 9]} /><meshStandardMaterial color="#b98061" roughness={0.72} /></mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={`leg-${side}`}>
          <Bar from={[side * 0.085, 1.0, 0]} to={[side * 0.1, 0.57, 0]} radius={0.078} color="#303a37" />
          <mesh position={[side * 0.1, 0.54, 0]}><sphereGeometry args={[0.072, 14, 10]} /><meshStandardMaterial color="#303a37" roughness={0.8} /></mesh>
          <Bar from={[side * 0.1, 0.51, 0]} to={[side * 0.105, 0.13, 0]} radius={0.061} color="#b98061" />
          <mesh position={[side * 0.105, 0.075, 0.055]} scale={[0.78, 0.5, 1.55]} castShadow><sphereGeometry args={[0.09, 16, 10]} /><meshStandardMaterial color="#171c1a" roughness={0.76} /></mesh>
        </group>
      ))}
      <Line points={[[-0.22, 0.02, 0.08], [-0.22, 1.8, 0.08]]} color="#d8ff3e" lineWidth={2} />
      <Html position={[0.34, 1.84, 0.08]} center><span className="dimension-label">1.80 m</span></Html>
    </group>
  )
}

function EquipmentNameLabel({ name, position }: { name: string; position: THREE.Vector3Tuple }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <span className="equipment-name-label">{name}</span>
    </Html>
  )
}

function SingleBagRack({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  return (
    <group>
      <SquareBeam from={[0, 0.06, 0.7]} to={[0, 2.24, 0.7]} size={0.085} />
      <SquareBeam from={[0, 2.2, 0.7]} to={[0, 2.4, 0]} size={0.085} />
      <SquareBeam from={[0, 0.06, 0.72]} to={[0, 0.06, -0.84]} size={0.075} />
      <SquareBeam from={[-0.72, 0.06, 0.7]} to={[0.72, 0.06, 0.7]} size={0.075} />
      <SquareBeam from={[0, 0.07, -0.62]} to={[0, 1.2, 0.68]} size={0.055} color="#252c29" />
      <AnchorPlate x={0} z={-0.83} rotation={Math.PI / 2} />
      <AnchorPlate x={-0.7} z={0.7} />
      <AnchorPlate x={0.7} z={0.7} />
      {rack.stations.map(renderMount)}
    </group>
  )
}

function LinearBagRack({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  const spacing = rack.stationSpacingMeters ?? 2.2
  const halfLength = Math.max(0.9, (rack.stationCount - 1) * spacing / 2 + 0.6)
  const supportBayCount = Math.max(1, Math.ceil(rack.stationCount / 2))
  const postXs = Array.from({ length: supportBayCount + 1 }, (_, index) => -halfLength + index * (halfLength * 2 / supportBayCount))
  return (
    <group>
      {postXs.map((x) => <SquareBeam key={`post-${x}`} from={[x, 0.06, 0.58]} to={[x, 2.44, 0.58]} size={0.08} />)}
      <SquareBeam from={[-halfLength - 0.12, 2.4, 0]} to={[halfLength + 0.12, 2.4, 0]} size={0.1} />
      {postXs.map((x) => <SquareBeam key={`support-${x}`} from={[x, 2.4, 0.58]} to={[x, 2.4, 0]} size={0.075} />)}
      {postXs.map((x) => <SquareBeam key={`base-${x}`} from={[x, 0.06, 0.72]} to={[x, 0.06, -0.72]} size={0.07} />)}
      {postXs.map((x) => <BeamGusset key={`gusset-${x}`} x={x} z={0.535} />)}
      {postXs.flatMap((x) => [-0.7, 0.7].map((z) => <AnchorPlate key={`${x}-${z}`} x={x} z={z} rotation={Math.PI / 2} />))}
      {rack.stations.map((station) => <TrolleyHousing key={`trolley-${station.id}`} station={station} />)}
      {rack.stations.map(renderMount)}
    </group>
  )
}

function RadialBagRack({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  return (
    <group>
      <SquareBeam from={[0, 0.06, 0]} to={[0, 2.44, 0]} size={0.1} />
      {rack.stations.map((station) => <SquareBeam key={`arm-${station.id}`} from={[0, 2.4, 0]} to={[station.localPosition[0], 2.4, station.localPosition[2]]} size={0.08} />)}
      {rack.stations.map((station) => <SquareBeam key={`brace-${station.id}`} from={[0, 1.58, 0]} to={[station.localPosition[0] * 0.68, 2.4, station.localPosition[2] * 0.68]} size={0.05} color="#252c29" />)}
      {rack.stations.map((station) => {
        const x = station.localPosition[0] * 0.86
        const z = station.localPosition[2] * 0.86
        return <group key={`foot-${station.id}`}><SquareBeam from={[0, 0.06, 0]} to={[x, 0.06, z]} size={0.075} /><AnchorPlate x={x} z={z} rotation={station.localRotation} /></group>
      })}
      {rack.stations.map(renderMount)}
    </group>
  )
}

function FourBagRack({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  const half = 0.915
  const corners: Array<[number, number]> = [[-half, -half], [half, -half], [half, half], [-half, half]]
  return (
    <group>
      {corners.map(([x, z]) => <SquareBeam key={`post-${x}-${z}`} from={[x, 0.06, z]} to={[x, 2.44, z]} size={0.076} />)}
      {corners.map(([x, z], index) => {
        const next = corners[(index + 1) % corners.length]
        return <SquareBeam key={`beam-${index}`} from={[x, 2.4, z]} to={[next[0], 2.4, next[1]]} size={0.076} />
      })}
      {corners.map(([x, z], index) => {
        const next = corners[(index + 1) % corners.length]
        const midpoint: THREE.Vector3Tuple = [(x + next[0]) / 2, 2.4, (z + next[1]) / 2]
        return <SquareBeam key={`brace-${index}`} from={[x, 1.58, z]} to={midpoint} size={0.048} color="#252c29" />
      })}
      {corners.map(([x, z]) => <AnchorPlate key={`plate-${x}-${z}`} x={x} z={z} />)}
      {rack.stations.map(renderMount)}
    </group>
  )
}

function SpeedBagPlatformStructure({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  return (
    <group>
      <SquareBeam from={[0, 1.55, 0.52]} to={[0, 2.62, 0.52]} size={0.09} />
      <SquareBeam from={[0, 2.28, 0.52]} to={[0, 2.28, 0]} size={0.075} />
      <SquareBeam from={[-0.18, 2.28, 0.12]} to={[-0.18, 2.08, 0.12]} size={0.028} color="#a4aaa7" />
      <SquareBeam from={[0.18, 2.28, 0.12]} to={[0.18, 2.08, 0.12]} size={0.028} color="#a4aaa7" />
      <mesh position={[0, 2.07, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.09, 44]} />
        <meshStandardMaterial color="#3a2b20" roughness={0.58} />
      </mesh>
      <mesh position={[0, 1.95, 0.42]} castShadow><boxGeometry args={[0.22, 0.32, 0.04]} /><meshStandardMaterial color="#222825" metalness={0.45} roughness={0.38} /></mesh>
      {[1.68, 2.5].map((y) => <mesh key={y} position={[0, y, .565]} castShadow><boxGeometry args={[.5, .09, .035]} /><meshStandardMaterial color="#202624" metalness={.45} roughness={.38} /></mesh>)}
      {rack.stations.map(renderMount)}
    </group>
  )
}

function DoubleEndAnchorStructure({ rack, renderMount }: { rack: RackConfiguration; renderMount: (station: RackStation) => React.ReactNode }) {
  const ceilingHeight = rack.ceilingHeightMeters ?? 3
  return (
    <group>
      <mesh position={[0, 0.035, 0]} castShadow receiveShadow><cylinderGeometry args={[0.13, 0.16, 0.07, 28]} /><meshStandardMaterial color="#555e5a" metalness={0.65} roughness={0.3} /></mesh>
      <mesh position={[0, ceilingHeight - 0.025, 0]} castShadow><cylinderGeometry args={[0.16, 0.16, 0.05, 28]} /><meshStandardMaterial color="#555e5a" metalness={0.65} roughness={0.3} /></mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <mesh key={angle} position={[Math.cos(angle) * 0.095, 0.075, Math.sin(angle) * 0.095]}><cylinderGeometry args={[0.009, 0.009, 0.07, 10]} /><meshStandardMaterial color="#252a28" metalness={0.72} roughness={0.28} /></mesh>)}
      {rack.stations.map(renderMount)}
    </group>
  )
}

function MountedBagVisual({ item, station, rack }: { item: PlacedEquipment; station: RackStation; rack: RackConfiguration }) {
  const setSelectedId = useGymStore((state) => state.setSelectedId)
  const selectedId = useGymStore((state) => state.selectedId)
  const [width, , height] = EQUIPMENT[item.kind].dimensions
  const radius = width / 2
  const isDoubleEnd = station.mountType.startsWith('double-end')
  const isSpeedBag = station.mountType === 'speed-bag-swivel'
  const bottomY = isDoubleEnd ? ((rack.ceilingHeightMeters ?? 3) - height) / 2 : station.localPosition[1] - height - (isSpeedBag ? 0.08 : 0.3)
  const profile = isSpeedBag
      ? speedBagProfile(radius, height).map((point) => [point.x, point.y])
      : item.kind === 'teardrop-bag'
        ? teardropBagProfile().map(([radial, vertical]) => [radius * radial, height * vertical])
        : [[0, 0], [radius * 0.9, height * 0.025], [radius, height * 0.08], [radius, height * 0.92], [radius * 0.88, height * 0.98], [0, height]]
  const lathePoints = profile.map(([radial, vertical]) => new THREE.Vector2(radial, vertical))
  const selected = selectedId === item.id
  const handleSelect = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); setSelectedId(item.id) }

  return (
    <group position={[station.localPosition[0], bottomY, station.localPosition[2]]} rotation={[0, station.localRotation, 0]} onClick={handleSelect}>
      {!isDoubleEnd && !isSpeedBag && <Chain x={0} top={height + 0.29} bottom={height + 0.05} />}
      {isDoubleEnd && <><Bar from={[0, -bottomY + 0.18, 0]} to={[0, 0, 0]} radius={0.007} color="#222725" /><Bar from={[0, height, 0]} to={[0, (rack.ceilingHeightMeters ?? 3) - bottomY - 0.18, 0]} radius={0.007} color="#222725" /></>}
      {isDoubleEnd && <DoubleEndBagBody diameter={width} height={height} bottomY={0} selected={selectedId === item.id} />}
      {!isDoubleEnd && <mesh castShadow receiveShadow>
        <latheGeometry args={[lathePoints, 48]} />
        <meshPhysicalMaterial color="#090b0a" roughness={0.48} metalness={0} clearcoat={0.22} clearcoatRoughness={0.44} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.004} emissive={selectedId === item.id ? ACCENT : '#000000'} emissiveIntensity={selectedId === item.id ? 0.18 : 0} />
      </mesh>}
      {isSpeedBag && Array.from({ length: 6 }, (_, index) => {
        const angle = index * Math.PI / 3
        const seamPath = new THREE.CatmullRomCurve3(lathePoints.slice(1, -1).map((point) => new THREE.Vector3(
          Math.cos(angle) * (point.x + .0012),
          point.y,
          Math.sin(angle) * (point.x + .0012),
        )))
        return <mesh key={angle}><tubeGeometry args={[seamPath, 30, .0013, 5, false]} /><meshStandardMaterial color="#424845" roughness={.72} /></mesh>
      })}
      {isSpeedBag && <mesh position={[0, height + .002, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[radius * .105, .0025, 7, 24]} /><meshStandardMaterial color="#252a28" roughness={.64} /></mesh>}
      {selected && <EquipmentNameLabel name={EQUIPMENT[item.kind].name} position={[radius + .14, height * .55, 0]} />}
    </group>
  )
}

function RackSystem({ item }: { item: PlacedEquipment }) {
  const equipment = useGymStore((state) => state.design.equipment)
  const selectedStationId = useGymStore((state) => state.selectedStationId)
  const setSelectedStation = useGymStore((state) => state.setSelectedStation)
  const rack = ensureRackConfiguration(item)
  if (!rack) return null
  const renderMount = (station: RackStation) => (
    <MountPoint
      key={station.id}
      station={station}
      selected={selectedStationId === station.id}
      onSelect={(event) => { event.stopPropagation(); setSelectedStation(item.id, station.id) }}
    />
  )
  const mounted = rack.stations
    .filter((station, index) => station.mountedEquipmentId && rack.stations.findIndex((candidate) => candidate.mountedEquipmentId === station.mountedEquipmentId) === index)
    .map((station) => {
      const mountedItem = equipment.find((candidate) => candidate.id === station.mountedEquipmentId)
      return mountedItem ? <MountedBagVisual key={mountedItem.id} item={mountedItem} station={station} rack={rack} /> : null
    })

  return <group>
    {rack.layout === 'single' && <SingleBagRack rack={rack} renderMount={renderMount} />}
    {rack.layout === 'linear' && <LinearBagRack rack={rack} renderMount={renderMount} />}
    {rack.layout === 'radial' && <RadialBagRack rack={rack} renderMount={renderMount} />}
    {rack.layout === 'square-4' && <FourBagRack rack={rack} renderMount={renderMount} />}
    {rack.layout === 'speed-platform' && <SpeedBagPlatformStructure rack={rack} renderMount={renderMount} />}
    {rack.layout === 'double-end' && <DoubleEndAnchorStructure rack={rack} renderMount={renderMount} />}
    {mounted}
  </group>
}

function EquipmentModel({ item }: { item: PlacedEquipment }) {
  const { kind } = item
  const asset = MODEL_ASSETS[kind]
  if (asset) return <LicensedModel asset={asset} dimensions={EQUIPMENT[kind].dimensions} />
  if (kind === 'boxing-ring') return <BoxingRing item={item} />
  if (kind === 'mma-cage') return <MmaCage item={item} />
  if (kind === 'wrestling-circle') {
    const color = FLOOR_COLORS[item.customization?.markingColor ?? 'red']
    return <group position={[0, 0.083, 0]}><Line points={Array.from({ length: 97 }, (_, index) => { const angle = index / 96 * Math.PI * 2; return [Math.cos(angle) * 4.5, 0, Math.sin(angle) * 4.5] as THREE.Vector3Tuple })} color={color} lineWidth={4} /><Line points={Array.from({ length: 97 }, (_, index) => { const angle = index / 96 * Math.PI * 2; return [Math.cos(angle) * 3.5, 0, Math.sin(angle) * 3.5] as THREE.Vector3Tuple })} color={color} lineWidth={4} /><Line points={Array.from({ length: 97 }, (_, index) => { const angle = index / 96 * Math.PI * 2; return [Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5] as THREE.Vector3Tuple })} color={color} lineWidth={4} /></group>
  }
  if (kind === 'heavy-bag' || kind === 'banana-bag' || kind === 'banana-bag-xl' || kind === 'teardrop-bag') return <HeavyBag kind={kind} />
  if (kind === 'double-end-25x18' || kind === 'double-end-30x20' || kind === 'double-end-35x22') return <DoubleEndBag kind={kind} />
  if (kind === 'speed-bag-18x13' || kind === 'speed-bag-20x15' || kind === 'speed-bag-23x18' || kind === 'speed-bag-25x20' || kind === 'speed-bag-28x22') return <SpeedBag kind={kind} />
  if (isProductBagKind(kind)) return <ProductBagModel kind={kind} />
  if (isRackKind(kind)) return null
  if (kind === 'bench') return <Bench />
  if (kind === 'equipment-rack') return <EquipmentRack />
  if (kind === 'reception-counter') return <ReceptionCounter />
  if (kind === 'wall-pads') return <WallPads />
  throw new Error(`Unsupported equipment kind: ${kind satisfies never}`)
}

function EquipmentObject({ item }: { item: PlacedEquipment }) {
  const selectedId = useGymStore((state) => state.selectedId)
  const setSelectedId = useGymStore((state) => state.setSelectedId)
  const dispatchInteraction = useGymStore((state) => state.dispatchInteraction)
  const commitEquipmentTransform = useGymStore((state) => state.commitEquipmentTransform)
  const transformMode = useGymStore((state) => state.transformMode)
  const room = useGymStore((state) => state.design.room)
  const snapPreferences = useGymStore((state) => state.snapPreferences)
  const invalidate = useThree((state) => state.invalidate)
  const objectRef = useRef<THREE.Group>(null)
  const dragOffset = useRef(new THREE.Vector3())
  const pointerStart = useRef<{ x: number; y: number; type: string; id: number } | null>(null)
  const initialTransform = useRef<TransformValue | null>(null)
  const captureTarget = useRef<Element | null>(null)
  const cancelGestureRef = useRef<() => void>(() => undefined)
  const finishRotationRef = useRef<() => void>(() => undefined)
  const dragging = useRef(false)
  const selected = selectedId === item.id
  const definition = EQUIPMENT[item.kind]
  const rack = ensureRackConfiguration(item)
  const [width, depth, objectHeight] = rack ? rackDimensions(rack) : definition.dimensions
  const showNameLabel = isRackKind(item.kind) || definition.category.includes('Bag')
  const hitWidth = Math.max(width, 0.8)
  const hitDepth = Math.max(depth, 0.8)
  const wallMountOptions = { roomWidth: room.width, roomDepth: room.depth, padWidth: width, padDepth: depth }
  const wallPadsMounted = item.kind !== 'wall-pads' || wallMountSide(item, wallMountOptions) !== null
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedId(item.id)
  }

  const restoreInitialTransform = () => {
    if (!objectRef.current || !initialTransform.current) return
    objectRef.current.position.set(initialTransform.current.x, 0, initialTransform.current.z)
    objectRef.current.rotation.y = initialTransform.current.rotation
    invalidate()
  }

  const clearPointerGesture = () => {
    pointerStart.current = null
    initialTransform.current = null
    captureTarget.current = null
    dragging.current = false
  }

  const cancelPointerGesture = () => {
    if (!pointerStart.current && !initialTransform.current) return
    restoreInitialTransform()
    const target = captureTarget.current
    const pointerId = pointerStart.current?.id
    clearPointerGesture()
    if (pointerId !== undefined && target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    dispatchInteraction({ type: 'cancel' })
  }
  cancelGestureRef.current = cancelPointerGesture

  useEffect(() => {
    const handleBlur = () => cancelGestureRef.current()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelGestureRef.current()
    }
    const handlePointerUp = () => finishRotationRef.current()
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerup', handlePointerUp)
      cancelGestureRef.current()
    }
  }, [])

  const commitTransform = (precisionModifier = false) => {
    if (!objectRef.current) return
    const before = initialTransform.current ?? { x: item.x, z: item.z, rotation: item.rotation }
    const candidate = {
      x: objectRef.current.position.x,
      z: objectRef.current.position.z,
      rotation: objectRef.current.rotation.y,
    }
    const next = item.kind === 'wall-pads' ? snapWallPadToMount(candidate, wallMountOptions) : candidate
    const committed = commitEquipmentTransform(item.id, before, next, precisionModifier)
    if (committed) {
      objectRef.current.position.set(committed.x, 0, committed.z)
      objectRef.current.rotation.y = committed.rotation
    }
  }

  const startRotation = () => {
    if (!objectRef.current || initialTransform.current) return
    initialTransform.current = {
      x: objectRef.current.position.x,
      z: objectRef.current.position.z,
      rotation: objectRef.current.rotation.y,
    }
    dispatchInteraction({ type: 'rotate-start', objectId: item.id })
  }

  const finishRotation = () => {
    if (!initialTransform.current || pointerStart.current) return
    commitTransform()
    clearPointerGesture()
  }
  finishRotationRef.current = finishRotation

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setSelectedId(item.id)
    if (transformMode !== 'translate' || !objectRef.current) return

    const floorPoint = event.ray.intersectPlane(floorPlane, new THREE.Vector3())
    if (!floorPoint) return
    dragOffset.current.copy(objectRef.current.position).sub(floorPoint)
    pointerStart.current = { x: event.clientX, y: event.clientY, type: event.pointerType, id: event.pointerId }
    initialTransform.current = { x: item.x, z: item.z, rotation: item.rotation }
    captureTarget.current = event.target as Element
    dispatchInteraction({ type: 'pointer-down', objectId: item.id, pointerId: event.pointerId })
    captureTarget.current.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId || !objectRef.current) return
    event.stopPropagation()
    if (!dragging.current) {
      if (!exceededDragThreshold(start.x, start.y, event.clientX, event.clientY, start.type)) return
      dragging.current = true
      dispatchInteraction({ type: 'drag-threshold', pointerId: event.pointerId })
    }
    const floorPoint = event.ray.intersectPlane(floorPlane, new THREE.Vector3())
    if (!floorPoint) return

    const next = floorPoint.add(dragOffset.current)
    const constrained = constrainTransform({ x: next.x, z: next.z, rotation: item.rotation }, {
      roomWidth: room.width,
      roomDepth: room.depth,
      objectWidth: width,
      objectDepth: depth,
      wallMargin: snapPreferences.wallMargin,
      moveSnap: moveSnapStep(snapPreferences.move, event.shiftKey),
      rotationSnap: null,
    }).value
    objectRef.current.position.set(constrained.x, 0, constrained.z)
    invalidate()
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId) return
    event.stopPropagation()
    const moved = dragging.current
    const target = captureTarget.current
    if (moved) commitTransform(event.shiftKey)
    else dispatchInteraction({ type: 'complete' })
    clearPointerGesture()
    if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }

  const object = (
    <group
      ref={objectRef}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotation, 0]}
      onClick={handleSelect}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelPointerGesture}
      onLostPointerCapture={cancelPointerGesture}
    >
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[hitWidth, hitDepth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {rack ? <RackSystem item={item} /> : <EquipmentModel item={item} />}
      {selected && showNameLabel && (
        <EquipmentNameLabel
          name={definition.name}
          position={rack ? [0, objectHeight + .16, 0] : [width / 2 + .14, Math.min(1.4, objectHeight * .55 + .85), 0]}
        />
      )}
      {selected && <HumanScaleReference x={width / 2 + 0.55} z={-(depth / 2 + 0.55)} />}
      {selected && !wallPadsMounted && (
        <Html position={[0, definition.dimensions[2] + 0.18, 0]} center>
          <span style={{ display: 'block', padding: '5px 8px', color: '#704910', background: '#fff5df', borderLeft: '3px solid #d29132', fontSize: '9px', fontWeight: 800, whiteSpace: 'nowrap' }}>Wall mounting required</span>
        </Html>
      )}
      {selected && (
        <Line
          points={[
            [-width / 2, 0.035, -depth / 2], [width / 2, 0.035, -depth / 2],
            [width / 2, 0.035, depth / 2], [-width / 2, 0.035, depth / 2],
            [-width / 2, 0.035, -depth / 2],
          ]}
          color={ACCENT}
          lineWidth={2}
        />
      )}
    </group>
  )

  return (
    <>
      {object}
      {selected && transformMode === 'rotate' && (
        <TransformControls
          object={objectRef.current ?? undefined}
          mode="rotate"
          showX={false}
          showY
          showZ={false}
          rotationSnap={rotationSnapStep(snapPreferences.rotation)}
          onMouseDown={startRotation}
          onMouseUp={finishRotation}
        />
      )}
    </>
  )
}

function SceneContent() {
  const equipment = useGymStore((state) => state.design.equipment)
  const setSelectedId = useGymStore((state) => state.setSelectedId)

  return (
    <>
      <color attach="background" args={['#c9cfcb']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#5a6761', 1.45]} />
      <directionalLight position={[10, 18, 8]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} />
      <directionalLight position={[-9, 9, -7]} intensity={1.15} color="#dbe4df" />
      <CameraRig />
      <group onPointerMissed={() => setSelectedId(null)}>
        <Room />
        {equipment.filter((item) => !item.mountedTo).map((item) => <EquipmentObject key={item.id} item={item} />)}
      </group>
    </>
  )
}

export function GymScene() {
  return (
    <Canvas id="gym-design-canvas" shadows dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}>
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}

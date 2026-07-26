import { useMemo } from 'react'
import * as THREE from 'three'
import { EQUIPMENT } from '../catalog/equipment'
import type { EquipmentKind } from '../domain/types'
import { BLACK_LEATHER_BUMP_TEXTURE } from './bagMaterials'

export type ProductBagKind =
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

const PRODUCT_BAG_KINDS = new Set<EquipmentKind>([
  'hb2-classic', 'hb3-extra-large', 'hb5-4ft', 'hb6-6ft-banana', 'hb7-pole',
  'hb10-bowling', 'hb11-uppercut', 'hb12-angle', 'hb13-super-angle',
  'hb15-super-teardrop', 'hb16-water', 'uc1-wall-unit', 'maddox-iii-dummy',
])

type HangingBagKind = Exclude<ProductBagKind, 'uc1-wall-unit' | 'maddox-iii-dummy'>

type BagConfiguration = {
  bodyHeight?: number
  bottomY: number
  profile: Array<[number, number]>
  seamLevels: number[]
  straps?: 3 | 4
  strapLevel?: number
  strapRise?: number
  tethered?: boolean
  waterLoop?: boolean
  panelSeams?: boolean
  glossy?: boolean
}

const BAG_CONFIGURATIONS: Record<HangingBagKind, BagConfiguration> = {
  'hb2-classic': { bottomY: 0.62, profile: [[0, 0], [.86, .006], [.97, .025], [1, .07], [1, .9], [.97, .94], [.82, .975], [0, 1]], seamLevels: [.07, .94], straps: 3 },
  'hb3-extra-large': { bottomY: 0.55, profile: [[0, 0], [.82, .006], [.96, .025], [1, .07], [1, .89], [.97, .94], [.8, .98], [0, 1]], seamLevels: [.07, .94], straps: 3 },
  'hb5-4ft': { bottomY: 0.38, profile: [[0, 0], [.9, .004], [.98, .018], [1, .05], [1, .94], [.97, .97], [.82, .992], [0, 1]], seamLevels: [.05, .94], straps: 3 },
  'hb6-6ft-banana': { bottomY: 0.08, profile: [[0, 0], [.9, .003], [.98, .014], [1, .04], [.995, .96], [.96, .982], [.8, .996], [0, 1]], seamLevels: [.04, .96], straps: 3 },
  'hb7-pole': { bodyHeight: 2.25, bottomY: 0.03, profile: [[0, 0], [.94, .002], [.99, .01], [1, .025], [1, .97], [.98, .985], [.88, .996], [0, 1]], seamLevels: [.025, .97], straps: 4 },
  'hb10-bowling': { bottomY: 0.36, profile: [[0, 0], [.3, .006], [.55, .025], [.75, .065], [.9, .12], [.98, .2], [1, .34], [.96, .48], [.82, .61], [.61, .72], [.43, .82], [.35, .94], [.24, .985], [0, 1]], seamLevels: [.34, .72], straps: 3 },
  'hb11-uppercut': { bottomY: 0.92, profile: [[0, 0], [.34, .008], [.62, .035], [.82, .08], [.95, .16], [1, .4], [.98, .58], [.83, .76], [.58, .9], [.36, .975], [0, 1]], seamLevels: [.4], straps: 3 },
  'hb12-angle': { bottomY: 0.24, profile: [[0, 0], [.24, .006], [.42, .02], [.54, .055], [.58, .14], [.58, .34], [.62, .48], [.7, .58], [.88, .66], [1, .73], [.98, .84], [.92, .91], [.76, .97], [.42, .995], [0, 1]], seamLevels: [.48, .66, .91], straps: 4, tethered: true },
  'hb13-super-angle': { bottomY: 0.48, profile: [[0, 0], [.48, .004], [.61, .014], [.636, .035], [.636, .46], [.67, .5], [.78, .55], [.95, .62], [1, .7], [.99, .81], [.93, .9], [.78, .97], [.42, .995], [0, 1]], seamLevels: [.46, .62, .9], straps: 4, strapLevel: .91, strapRise: .12 },
  'hb15-super-teardrop': { bottomY: 0.54, profile: [[0, 0], [.24, .008], [.46, .03], [.66, .075], [.82, .14], [.97, .28], [1, .43], [.94, .58], [.76, .74], [.48, .9], [.28, .98], [0, 1]], seamLevels: [.43], straps: 3 },
  'hb16-water': { bottomY: 0.9, profile: [[0, 0], [.38, .025], [.64, .08], [.82, .16], [.95, .28], [1, .4], [.99, .48], [.9, .62], [.72, .78], [.45, .92], [.22, 1]], seamLevels: [.42], waterLoop: true, panelSeams: false, glossy: true },
}

// The scene router consumes this guard alongside the model component.
// eslint-disable-next-line react-refresh/only-export-components
export function isProductBagKind(kind: EquipmentKind): kind is ProductBagKind {
  return PRODUCT_BAG_KINDS.has(kind)
}

function Rod({ from, to, radius = 0.012, color = '#202523' }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; radius?: number; color?: string }) {
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
      <meshStandardMaterial color={color} roughness={0.54} metalness={0.12} />
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

function FrameBeam({ from, to, size = 0.07, color = '#171c1a' }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; size?: number; color?: string }) {
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
      <meshStandardMaterial color={color} metalness={0.56} roughness={0.34} />
    </mesh>
  )
}

function FootPlate({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <mesh position={[x, 0.025, z]} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.22, 0.05, 0.14]} />
      <meshStandardMaterial color="#111513" metalness={0.62} roughness={0.36} />
    </mesh>
  )
}

function Chain({ top, bottom }: { top: number; bottom: number }) {
  const linkCount = Math.max(5, Math.ceil((top - bottom) / 0.034))
  return Array.from({ length: linkCount }, (_, index) => (
    <mesh
      key={index}
      position={[0, bottom + (index + .5) * ((top - bottom) / linkCount), 0]}
      rotation={[0, index % 2 ? Math.PI / 2 : 0, 0]}
      castShadow
    >
      <torusGeometry args={[0.021, 0.0048, 7, 14]} />
      <meshStandardMaterial color="#747c79" roughness={0.27} metalness={0.78} />
    </mesh>
  ))
}

function profileRadiusAt(profile: Array<[number, number]>, level: number) {
  const upperIndex = profile.findIndex(([, vertical]) => vertical >= level)
  if (upperIndex <= 0) return profile[Math.max(0, upperIndex)]?.[0] ?? 0
  const [lowerRadius, lowerY] = profile[upperIndex - 1]
  const [upperRadius, upperY] = profile[upperIndex]
  const progress = (level - lowerY) / (upperY - lowerY)
  return THREE.MathUtils.lerp(lowerRadius, upperRadius, progress)
}

function LeatherBody({ profile, radius, height, bottomY, seamLevels, panelSeams = true, glossy = false }: { profile: Array<[number, number]>; radius: number; height: number; bottomY: number; seamLevels: number[]; panelSeams?: boolean; glossy?: boolean }) {
  const points = profile.map(([radial, vertical]) => new THREE.Vector2(radius * radial, height * vertical))
  return (
    <group>
      <mesh position={[0, bottomY, 0]} castShadow receiveShadow>
        <latheGeometry args={[points, 64]} />
        <meshPhysicalMaterial
          color="#0a0c0b"
          roughness={glossy ? 0.3 : 0.5}
          metalness={0}
          clearcoat={glossy ? 0.5 : 0.2}
          clearcoatRoughness={glossy ? 0.24 : 0.46}
          bumpMap={BLACK_LEATHER_BUMP_TEXTURE}
          bumpScale={0.006}
        />
      </mesh>
      {seamLevels.map((level) => (
        <mesh key={level} position={[0, bottomY + height * level, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[radius * profileRadiusAt(profile, level) + .0015, 0.003, 7, 64]} />
          <meshStandardMaterial color="#252927" roughness={0.66} />
        </mesh>
      ))}
      {panelSeams && Array.from({ length: 6 }, (_, index) => {
        const angle = index * Math.PI / 3
        const seamPath = new THREE.CatmullRomCurve3(profile.slice(1, -1).map(([radial, vertical]) => (
          new THREE.Vector3(
            Math.cos(angle) * (radius * radial + .0015),
            bottomY + height * vertical,
            Math.sin(angle) * (radius * radial + .0015),
          )
        )))
        return (
          <mesh key={angle} castShadow>
            <tubeGeometry args={[seamPath, 36, 0.0022, 5, false]} />
            <meshStandardMaterial color="#1e2220" roughness={0.7} />
          </mesh>
        )
      })}
    </group>
  )
}

function HangingProductBag({ kind }: { kind: HangingBagKind }) {
  const [diameter, , catalogHeight] = EQUIPMENT[kind].dimensions
  const configuration = BAG_CONFIGURATIONS[kind]
  const height = configuration.bodyHeight ?? catalogHeight
  const radius = diameter / 2
  const bottomY = configuration.bottomY
  const topY = bottomY + height
  const strapLevel = configuration.strapLevel ?? .955
  const strapAttachmentY = bottomY + height * strapLevel
  const strapAttachmentRadius = radius * profileRadiusAt(configuration.profile, strapLevel) * .96
  const strapRingY = topY + (configuration.waterLoop ? .045 : (configuration.strapRise ?? Math.min(0.22, height * 0.18)))
  const chainTopY = kind === 'hb7-pole' ? 2.7 : strapRingY + 0.24
  const frameTop = chainTopY + 0.12
  const strapCount = configuration.straps ?? 3

  return (
    <group>
      <FrameBeam from={[0, 0.06, 0.66]} to={[0, frameTop, 0.66]} size={0.085} />
      <FrameBeam from={[0, frameTop - 0.04, 0.66]} to={[0, frameTop - 0.04, 0]} size={0.085} />
      <FrameBeam from={[0, 0.06, 0.68]} to={[0, 0.06, -0.78]} size={0.072} />
      <FrameBeam from={[-0.66, 0.06, 0.66]} to={[0.66, 0.06, 0.66]} size={0.072} />
      <FrameBeam from={[-0.62, 0.07, 0.66]} to={[0, Math.min(1.35, frameTop * 0.52), 0.66]} size={0.052} color="#252c29" />
      <FrameBeam from={[0.62, 0.07, 0.66]} to={[0, Math.min(1.35, frameTop * 0.52), 0.66]} size={0.052} color="#252c29" />
      <FootPlate x={0} z={-0.77} rotation={Math.PI / 2} />
      <FootPlate x={-0.64} z={0.66} />
      <FootPlate x={0.64} z={0.66} />
      <LeatherBody profile={configuration.profile} radius={radius} height={height} bottomY={bottomY} seamLevels={configuration.seamLevels} panelSeams={configuration.panelSeams} glossy={configuration.glossy} />
      {!configuration.waterLoop && Array.from({ length: strapCount }, (_, index) => {
        const angle = index * Math.PI * 2 / strapCount
        const strapX = Math.cos(angle) * strapAttachmentRadius
        const strapZ = Math.sin(angle) * strapAttachmentRadius
        return (
          <group key={angle}>
            <WebbingStrap from={[strapX, strapAttachmentY, strapZ]} to={[0, strapRingY, 0]} />
            <mesh position={[strapX, strapAttachmentY, strapZ]} rotation={[0, angle, 0]} castShadow>
              <torusGeometry args={[0.026, 0.006, 8, 20]} />
              <meshStandardMaterial color="#686f6c" roughness={0.3} metalness={0.72} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, strapRingY, 0]} castShadow>
        <torusGeometry args={[configuration.waterLoop ? .03 : .048, configuration.waterLoop ? .008 : .011, 10, 28]} />
        <meshStandardMaterial color="#8b9490" roughness={0.26} metalness={0.78} />
      </mesh>
      {configuration.waterLoop
        ? <><Rod from={[-.017, strapRingY + .018, 0]} to={[-.017, chainTopY, 0]} radius={.006} color="#0b0d0c" /><Rod from={[.017, strapRingY + .018, 0]} to={[.017, chainTopY, 0]} radius={.006} color="#0b0d0c" /></>
        : <Chain bottom={strapRingY + .04} top={chainTopY - .025} />}
      <mesh position={[0, chainTopY, 0]} castShadow>
        <torusGeometry args={[0.042, 0.011, 10, 28]} />
        <meshStandardMaterial color="#737b78" roughness={0.3} metalness={0.72} />
      </mesh>
      {configuration.tethered && (
        <>
          <Rod from={[0, bottomY - .005, 0]} to={[0, 0.06, 0]} radius={0.008} color="#202422" />
          <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 10, 28]} />
            <meshStandardMaterial color="#666e6b" roughness={0.32} metalness={0.7} />
          </mesh>
        </>
      )}
    </group>
  )
}

function WallUppercutUnit() {
  const sideProfile = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, -.35)
    shape.lineTo(.22, -.35)
    shape.lineTo(.22, -.07)
    shape.quadraticCurveTo(.22, .01, .3, .06)
    shape.lineTo(.4, .13)
    shape.lineTo(.4, .35)
    shape.lineTo(0, .35)
    shape.closePath()
    return shape
  }, [])

  return (
    <group>
      <mesh position={[-.29, .68, .2]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[sideProfile, { depth: .58, bevelEnabled: true, bevelSegments: 3, bevelSize: .012, bevelThickness: .012, curveSegments: 12 }]} />
        <meshPhysicalMaterial color="#090b0a" roughness={0.5} clearcoat={0.2} clearcoatRoughness={0.46} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.005} />
      </mesh>
      {[-.21, .21].map((x) => [-.43, .43].map((offsetY) => (
        <group key={`${x}-${offsetY}`}>
          <mesh position={[x, .68 + offsetY, .29]} castShadow>
            <boxGeometry args={[.055, .18, .025]} />
            <meshStandardMaterial color="#222825" roughness={.4} metalness={.45} />
          </mesh>
          <mesh position={[x, .68 + offsetY, .305]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[.008, .008, .03, 10]} />
            <meshStandardMaterial color="#808784" roughness={.28} metalness={.78} />
          </mesh>
        </group>
      )))}
    </group>
  )
}

function HybridDummy() {
  const torsoProfile = [
    [0, 0], [.18, .01], [.22, .08], [.2, .25], [.22, .48], [.3, .7], [.34, .82], [.28, .93], [.12, 1], [0, 1],
  ].map(([radius, vertical]) => new THREE.Vector2(radius, vertical * 0.9))
  const headProfile = [
    [0, 0], [.09, .02], [.14, .18], [.17, .48], [.15, .8], [.1, .96], [0, 1],
  ].map(([radius, vertical]) => new THREE.Vector2(radius, vertical * 0.34))

  return (
    <group>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.375, 0.375, 0.22, 48]} />
        <meshStandardMaterial color="#171b19" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <latheGeometry args={[torsoProfile, 56]} />
        <meshPhysicalMaterial color="#090b0a" roughness={0.51} clearcoat={0.18} clearcoatRoughness={0.48} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.005} />
      </mesh>
      <mesh position={[0, 1.31, 0]} castShadow>
        <latheGeometry args={[headProfile, 48]} />
        <meshPhysicalMaterial color="#090b0a" roughness={0.52} clearcoat={0.16} clearcoatRoughness={0.5} bumpMap={BLACK_LEATHER_BUMP_TEXTURE} bumpScale={0.004} />
      </mesh>
      <mesh position={[0, 1.27, 0]} castShadow><cylinderGeometry args={[.1, .115, .16, 28]} /><meshStandardMaterial color="#090b0a" roughness={.42} /></mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Rod from={[side * .23, 1.04, 0]} to={[side * .43, .74, 0]} radius={.075} color="#090b0a" />
          <Rod from={[side * .43, .74, 0]} to={[side * .37, .47, -.02]} radius={.065} color="#090b0a" />
          <mesh position={[side * .36, .42, -.02]} castShadow><sphereGeometry args={[.075, 20, 16]} /><meshStandardMaterial color="#090b0a" roughness={.44} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.265, 0.009, 8, 48]} />
        <meshStandardMaterial color="#343a37" roughness={0.6} />
      </mesh>
    </group>
  )
}

export function ProductBagModel({ kind }: { kind: ProductBagKind }) {
  if (kind === 'uc1-wall-unit') return <WallUppercutUnit />
  if (kind === 'maddox-iii-dummy') return <HybridDummy />
  return <HangingProductBag kind={kind} />
}
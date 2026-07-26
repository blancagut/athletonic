import { RoundedBox } from '@react-three/drei'
import { POWDER_COAT_BUMP_TEXTURE } from './materialTextures'

const STEEL = '#303735'
const DARK_STEEL = '#202624'
const RUBBER = '#151817'
const VINYL = '#344743'
const HARDWARE = '#8a918e'

function BoxPart({
  position,
  size,
  color = STEEL,
  metalness = 0.48,
  roughness = 0.46,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color?: string
  metalness?: number
  roughness?: number
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness} clearcoat={0.07} clearcoatRoughness={0.58} bumpMap={POWDER_COAT_BUMP_TEXTURE} bumpScale={0.0025} />
    </mesh>
  )
}

function LevelingFoot({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.018, 0]} castShadow>
        <cylinderGeometry args={[0.043, 0.048, 0.036, 16]} />
        <meshStandardMaterial color={RUBBER} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.04, 12]} />
        <meshStandardMaterial color={HARDWARE} metalness={0.8} roughness={0.28} />
      </mesh>
    </group>
  )
}

export function Bench() {
  return (
    <group>
      <RoundedBox args={[1.5, 0.105, 0.48]} radius={0.025} smoothness={3} position={[0, 0.4275, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#303a37" roughness={0.66} clearcoat={0.08} clearcoatRoughness={0.75} />
      </RoundedBox>
      <BoxPart position={[0, 0.355, 0]} size={[1.32, 0.045, 0.32]} color={DARK_STEEL} />
      {[-0.57, 0.57].map((x) => (
        <group key={x}>
          <BoxPart position={[x, 0.19, -0.155]} size={[0.055, 0.32, 0.055]} />
          <BoxPart position={[x, 0.19, 0.155]} size={[0.055, 0.32, 0.055]} />
          <BoxPart position={[x, 0.095, 0]} size={[0.055, 0.055, 0.31]} />
          <LevelingFoot x={x} z={-0.17} />
          <LevelingFoot x={x} z={0.17} />
        </group>
      ))}
      <BoxPart position={[0, 0.245, 0]} size={[1.14, 0.045, 0.045]} />
      {[-0.57, 0.57].flatMap((x) => [-0.16, 0.16].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.362, z]} castShadow>
          <cylinderGeometry args={[0.009, 0.009, 0.012, 12]} />
          <meshStandardMaterial color={HARDWARE} metalness={0.76} roughness={0.3} />
        </mesh>
      )))}
    </group>
  )
}

function Shelf({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <BoxPart position={[0, 0, 0]} size={[1.7, 0.045, 0.49]} color="#3a4240" />
      <BoxPart position={[0, 0.065, -0.245]} size={[1.7, 0.13, 0.035]} color={DARK_STEEL} />
      <BoxPart position={[0, 0.035, 0.245]} size={[1.7, 0.07, 0.035]} color={DARK_STEEL} />
      {Array.from({ length: 11 }, (_, index) => (
        <BoxPart key={index} position={[-0.75 + index * 0.15, 0.027, 0]} size={[0.018, 0.018, 0.45]} color="#7a817e" metalness={0.7} roughness={0.34} />
      ))}
    </group>
  )
}

export function EquipmentRack() {
  return (
    <group>
      {[-0.865, 0.865].flatMap((x) => [-0.235, 0.235].map((z) => (
        <group key={`${x}-${z}`}>
          <BoxPart position={[x, 0.96, z]} size={[0.055, 1.82, 0.055]} />
          <LevelingFoot x={x} z={z} />
        </group>
      )))}
      {[0.18, 0.72, 1.26, 1.78].map((y) => <Shelf key={y} y={y} />)}
      {[0.18, 1.84].map((y) => (
        <group key={y}>
          <BoxPart position={[0, y, -0.235]} size={[1.78, 0.05, 0.05]} />
          <BoxPart position={[0, y, 0.235]} size={[1.78, 0.05, 0.05]} />
        </group>
      ))}
      {[-0.865, 0.865].map((x) => (
        <group key={x}>
          <BoxPart position={[x, 1.52, 0]} size={[0.04, 0.04, 0.46]} />
          <BoxPart position={[x, 0.99, 0]} size={[0.04, 0.04, 0.46]} />
          {[0.18, 0.72, 1.26, 1.78].map((y) => (
            <mesh key={y} position={[x, y + 0.02, 0.265]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.012, 12]} />
              <meshStandardMaterial color={HARDWARE} metalness={0.82} roughness={0.24} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function ReceptionCounter() {
  return (
    <group>
      <RoundedBox args={[2.4, 1.08, 0.72]} radius={0.055} smoothness={4} position={[0, 0.54, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#29332f" roughness={0.62} />
      </RoundedBox>
      <BoxPart position={[0, 1.105, 0]} size={[2.5, 0.09, 0.82]} color="#b8bfbb" metalness={0.12} roughness={0.46} />
      <BoxPart position={[0, 0.57, -0.371]} size={[2.14, 0.72, 0.035]} color="#d8ff3e" metalness={0.04} roughness={0.64} />
      <BoxPart position={[0, 0.57, -0.393]} size={[1.55, 0.34, 0.018]} color="#1b2320" metalness={0.12} roughness={0.7} />
      <BoxPart position={[0, 0.2, 0.31]} size={[1.8, 0.035, 0.16]} color="#59635f" />
      {[-0.98, 0.98].map((x) => <LevelingFoot key={x} x={x} z={0.27} />)}
    </group>
  )
}

function PadPanel({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <BoxPart position={[0, 0.9, -0.045]} size={[0.765, 1.72, 0.03]} color="#4b514f" metalness={0.18} roughness={0.62} />
      <RoundedBox args={[0.775, 1.78, 0.085]} radius={0.025} smoothness={3} position={[0, 0.9, 0.0175]} castShadow receiveShadow>
        <meshPhysicalMaterial color={VINYL} roughness={0.72} clearcoat={0.06} clearcoatRoughness={0.82} />
      </RoundedBox>
      {[-0.375, 0.375].map((edge) => (
        <BoxPart key={edge} position={[edge, 0.9, 0.061]} size={[0.005, 1.72, 0.005]} color="#202927" metalness={0} roughness={0.88} />
      ))}
    </group>
  )
}

export function WallPads() {
  return (
    <group>
      <BoxPart position={[0, 1.745, -0.052]} size={[2.4, 0.045, 0.035]} color={HARDWARE} metalness={0.68} roughness={0.32} />
      <BoxPart position={[0, 0.055, -0.052]} size={[2.4, 0.045, 0.035]} color={HARDWARE} metalness={0.68} roughness={0.32} />
      {[-0.8, 0, 0.8].map((x) => <PadPanel key={x} x={x} />)}
    </group>
  )
}

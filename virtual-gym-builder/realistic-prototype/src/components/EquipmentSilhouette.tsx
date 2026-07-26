import type { EquipmentKind } from '../domain/types'

type BagShape = 'cylinder' | 'banana' | 'teardrop' | 'double-end' | 'speed' | 'bowling' | 'uppercut' | 'angle' | 'water' | 'wall' | 'dummy'

const BAG_SHAPES: Partial<Record<EquipmentKind, BagShape>> = {
  'heavy-bag': 'cylinder',
  'banana-bag': 'banana',
  'banana-bag-xl': 'banana',
  'teardrop-bag': 'teardrop',
  'double-end-25x18': 'double-end',
  'double-end-30x20': 'double-end',
  'double-end-35x22': 'double-end',
  'speed-bag-18x13': 'speed',
  'speed-bag-20x15': 'speed',
  'speed-bag-23x18': 'speed',
  'speed-bag-25x20': 'speed',
  'speed-bag-28x22': 'speed',
  'hb2-classic': 'cylinder',
  'hb3-extra-large': 'cylinder',
  'hb5-4ft': 'cylinder',
  'hb6-6ft-banana': 'banana',
  'hb7-pole': 'banana',
  'hb10-bowling': 'bowling',
  'hb11-uppercut': 'uppercut',
  'hb12-angle': 'angle',
  'hb13-super-angle': 'angle',
  'hb15-super-teardrop': 'teardrop',
  'hb16-water': 'water',
  'uc1-wall-unit': 'wall',
  'maddox-iii-dummy': 'dummy',
}

function BagSilhouette({ shape }: { shape: BagShape }) {
  return (
    <svg className="bag-silhouette" viewBox="0 0 40 44" aria-hidden="true">
      {shape === 'cylinder' && <path d="M13 8 Q20 4 27 8 L28 35 Q20 39 12 35Z" />}
      {shape === 'banana' && <path d="M14 5 Q20 2 26 5 L27 39 Q20 42 13 39Z" />}
      {shape === 'teardrop' && <path d="M20 5 C18 11 9 19 10 28 C11 37 15 40 20 40 C25 40 29 37 30 28 C31 19 22 11 20 5Z" />}
      {shape === 'double-end' && <><path className="silhouette-line" d="M20 1V10M20 34V43" /><path d="M20 9 C13 13 10 18 11 22 C10 27 13 32 20 35 C27 32 30 27 29 22 C30 18 27 13 20 9Z" /></>}
      {shape === 'speed' && <><path className="silhouette-line" d="M8 5H32M20 5V10" /><path d="M20 9 C17 14 11 18 12 27 C13 35 16 39 20 41 C24 39 27 35 28 27 C29 18 23 14 20 9Z" /></>}
      {shape === 'bowling' && <path d="M18 5H22 C22 12 28 15 29 24 C30 34 26 39 20 40 C14 39 10 34 11 24 C12 15 18 12 18 5Z" />}
      {shape === 'uppercut' && <path d="M20 7 C12 8 8 15 9 24 C10 34 14 39 20 40 C26 39 30 34 31 24 C32 15 28 8 20 7Z" />}
      {shape === 'angle' && <path d="M15 5H25 L26 20 L31 24 L28 39 H12 L9 24 L14 20Z" />}
      {shape === 'water' && <path d="M20 5 C18 12 10 17 10 27 C10 36 14 40 20 40 C26 40 30 36 30 27 C30 17 22 12 20 5Z" />}
      {shape === 'wall' && <><path className="silhouette-frame" d="M7 5H33V40H7Z" /><path d="M14 10H26V34H14Z M8 15H14V31H8Z M26 15H32V31H26Z" /></>}
      {shape === 'dummy' && <><circle cx="20" cy="8" r="5" /><path d="M14 14 Q20 11 26 14 L27 31 H13Z M13 17L7 29L11 31L17 20 M27 17L33 29L29 31L23 20 M12 32H28L31 40H9Z" /></>}
    </svg>
  )
}

function RackSilhouette({ stations }: { stations: number }) {
  return (
    <svg className="bag-silhouette rack-silhouette" viewBox="0 0 40 44" aria-hidden="true">
      {stations === 1 && <><path className="silhouette-frame" d="M30 40V6H12M30 21L20 40M30 40H38M20 40H8" /><path d="M12 6V13M9 13H15V33Q12 37 9 33Z" /></>}
      {stations === 2 && <><path className="silhouette-frame" d="M3 12H37M5 12V39M35 12V39M2 39H8M32 39H38M10 12V18M20 12V18M30 12V18" /><circle cx="10" cy="19" r="1.8" /><circle cx="20" cy="19" r="1.8" /><circle cx="30" cy="19" r="1.8" /></>}
      {stations === 3 && <><path className="silhouette-frame" d="M20 22V5M20 7L5 16M20 7L35 16M20 22L7 39M20 22L33 39" /><circle cx="20" cy="22" r="2.5" /><circle cx="20" cy="5" r="3" /><circle cx="5" cy="16" r="3" /><circle cx="35" cy="16" r="3" /></>}
      {stations === 4 && <><path className="silhouette-frame" d="M7 7H33V33H7ZM7 7L13 13M33 7L27 13M33 33L27 27M7 33L13 27" /><circle cx="20" cy="7" r="3" /><circle cx="33" cy="20" r="3" /><circle cx="20" cy="33" r="3" /><circle cx="7" cy="20" r="3" /></>}
    </svg>
  )
}

function StructureSilhouette({ kind }: { kind: 'boxing-ring' | 'mma-cage' }) {
  return (
    <svg className="bag-silhouette" viewBox="0 0 40 44" aria-hidden="true">
      {kind === 'boxing-ring' ? <>
        <path className="silhouette-frame" d="M6 12V38M34 12V38M8 14H32M7 20H33M7 26H33M6 32H34M4 38H36" />
        <path d="M4 34H36V40H4Z" />
      </> : <>
        <path className="silhouette-frame" d="M20 4L34 10L39 23L32 37L20 42L8 37L1 23L6 10ZM20 8L31 13L35 23L29 33L20 38L11 33L5 23L9 13Z" />
        <path d="M6 34L20 40L34 34V40L20 44L6 40Z" />
      </>}
    </svg>
  )
}

function TrainingSystemSilhouette({ kind }: { kind: 'wrestling-circle' | 'speed-bag-platform' | 'double-end-system' }) {
  return (
    <svg className="bag-silhouette" viewBox="0 0 40 44" aria-hidden="true">
      {kind === 'wrestling-circle' && <>
        <path d="M3 18L20 8L37 18L20 38Z" opacity=".22" />
        <path className="silhouette-frame" d="M3 18L20 8L37 18L20 38Z" />
        <ellipse className="silhouette-frame" cx="20" cy="23" rx="12" ry="8" />
        <circle cx="16" cy="19" r="2" /><circle cx="24" cy="19" r="2" />
        <path className="silhouette-line" d="M17 21L21 24L24 21M15 22L13 27M25 22L27 27M19 24L16 29M21 24L24 29" />
      </>}
      {kind === 'speed-bag-platform' && <>
        <path className="silhouette-frame" d="M8 4H32M12 4V38M8 38H18M15 11H34V16H15M31 16V20" />
        <path d="M31 19 C27 22 26 26 27 30 C28 34 29 36 31 38 C33 36 34 34 35 30 C36 26 35 22 31 19Z" />
      </>}
      {kind === 'double-end-system' && <>
        <path className="silhouette-frame" d="M7 5H33M7 39H33M10 5V39M30 5V39M20 5V13M20 31V39" />
        <path d="M20 12 C14 16 13 20 14 22 C13 26 15 30 20 32 C25 30 27 26 26 22 C27 20 26 16 20 12Z" />
        <circle cx="20" cy="5" r="2" /><circle cx="20" cy="39" r="2" />
      </>}
    </svg>
  )
}

function FacilitiesSilhouette({ kind }: { kind: 'bench' | 'wall-pads' | 'equipment-rack' | 'reception-counter' }) {
  return (
    <svg className="bag-silhouette" viewBox="0 0 40 44" aria-hidden="true">
      {kind === 'bench' && <>
        <path d="M4 13H36V19H4Z" />
        <path className="silhouette-frame" d="M8 19V38M32 19V38M8 30H32M5 38H12M28 38H35" />
      </>}
      {kind === 'wall-pads' && <>
        <path className="silhouette-frame" d="M3 5H37V40H3ZM14 5V40M26 5V40" />
        <path d="M5 7H12V38H5ZM16 7H24V38H16ZM28 7H35V38H28Z" />
      </>}
      {kind === 'equipment-rack' && <>
        <path className="silhouette-frame" d="M5 3V41M35 3V41M3 41H9M31 41H37M5 5H35M5 14H35M5 23H35M5 32H35" />
        <path d="M7 11H33V14H7ZM7 20H33V23H7ZM7 29H33V32H7ZM7 38H33V41H7Z" />
      </>}
      {kind === 'reception-counter' && <>
        <path d="M3 14H37V35H3Z" />
        <path className="silhouette-frame" d="M2 12H38V16H2ZM7 35V40M33 35V40M8 20H32V30H8Z" />
      </>}
    </svg>
  )
}

export function EquipmentSilhouette({ kind }: { kind: EquipmentKind }) {
  if (kind === 'boxing-ring' || kind === 'mma-cage') return <StructureSilhouette kind={kind} />
  if (kind.startsWith('bag-rack-')) return <RackSilhouette stations={Number(kind.at(-1))} />
  if (kind === 'wrestling-circle' || kind === 'speed-bag-platform' || kind === 'double-end-system') return <TrainingSystemSilhouette kind={kind} />
  if (kind === 'bench' || kind === 'wall-pads' || kind === 'equipment-rack' || kind === 'reception-counter') return <FacilitiesSilhouette kind={kind} />
  const shape = BAG_SHAPES[kind]
  return shape ? <BagSilhouette shape={shape} /> : null
}
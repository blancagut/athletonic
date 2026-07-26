import * as THREE from 'three'

function createSurfaceTexture(name: string, size: number, sample: (x: number, y: number) => number, repeat: number) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = Math.round(THREE.MathUtils.clamp(sample(x, y), 0, 1) * 255)
      const offset = (y * size + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.name = name
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.needsUpdate = true
  return texture
}

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}

export const EVA_BUMP_TEXTURE = createSurfaceTexture(
  'eva-fine-grain',
  64,
  (x, y) => 0.42 + hash(x, y) * 0.22 + (x % 8 === 0 || y % 8 === 0 ? 0.04 : 0),
  18,
)

export const CANVAS_BUMP_TEXTURE = createSurfaceTexture(
  'woven-canvas',
  64,
  (x, y) => 0.42 + (x % 4 < 2 ? 0.12 : 0) + (y % 4 < 2 ? 0.1 : 0) + hash(x, y) * 0.035,
  14,
)

export const POWDER_COAT_BUMP_TEXTURE = createSurfaceTexture(
  'powder-coated-steel',
  48,
  (x, y) => 0.46 + hash(x, y) * 0.18,
  10,
)
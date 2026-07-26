import * as THREE from 'three'

export const BLACK_LEATHER_BUMP_TEXTURE = (() => {
  const size = 128
  const data = new Uint8Array(size * size)
  let seed = 0x13b5a7

  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    data[index] = 112 + ((seed >>> 24) % 32)
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 11)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
})()
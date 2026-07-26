import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ModelAsset } from '../catalog/modelAssets'

interface LicensedModelProps {
  asset: ModelAsset
  dimensions: [number, number, number]
}

export function LicensedModel({ asset, dimensions }: LicensedModelProps) {
  const { scene } = useGLTF(asset.url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const size = bounds.getSize(new THREE.Vector3())
    const scale = Math.min(
      dimensions[0] / Math.max(size.x, 0.001),
      dimensions[1] / Math.max(size.z, 0.001),
      dimensions[2] / Math.max(size.y, 0.001),
    )

    clone.scale.setScalar(scale)
    clone.updateMatrixWorld(true)

    const scaledBounds = new THREE.Box3().setFromObject(clone)
    const center = scaledBounds.getCenter(new THREE.Vector3())
    clone.position.set(-center.x, -scaledBounds.min.y, -center.z)

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
    })

    return clone
  }, [asset.rotation, dimensions, scene])

  return (
    <group rotation={asset.rotation ?? [0, 0, 0]}>
      <primitive object={model} />
    </group>
  )
}
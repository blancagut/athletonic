import type { EquipmentKind } from '../domain/types'

export interface ModelAsset {
  url: string
  attribution: string
  license: string
  rotation?: [number, number, number]
}

export const MODEL_ASSETS: Partial<Record<EquipmentKind, ModelAsset>> = {
  // Add only downloaded assets whose commercial-use license has been verified.
  // 'boxing-ring': {
  //   url: '/models/boxing-ring.glb',
  //   attribution: 'Boxing Ring by Kopag 3D',
  //   license: 'Sketchfab Standard License',
  // },
  // 'heavy-bag': {
  //   url: '/models/heavy-bag.glb',
  //   attribution: 'Vintage / Old punching bag by maxsbond.work',
  //   license: 'CC BY 4.0',
  // },
}
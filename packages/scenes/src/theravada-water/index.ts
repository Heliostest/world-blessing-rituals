import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createTheravadaWater } from './scene'

export const meta: SceneMeta = {
  id: 'theravada-water',
  title: '花水位一倾',
  traditionSlug: 'theravada-buddhism',
  grade: 'C',
  sensitivity: '低',
  gestures: ['tilt', 'drag'],
}

export function create(ctx: SceneContext) {
  return createTheravadaWater(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

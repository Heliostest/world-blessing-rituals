import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createSlavicWreath } from './scene'

export const meta: SceneMeta = {
  id: 'slavic-wreath',
  title: '火边花环',
  traditionSlug: 'slavic-folk',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createSlavicWreath(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

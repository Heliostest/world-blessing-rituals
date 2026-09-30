import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createTibetanWheel } from './scene'

export const meta: SceneMeta = {
  id: 'tibetan-wheel',
  title: '廊前轻转',
  traditionSlug: 'tibetan-buddhism',
  grade: 'C',
  sensitivity: '中',
  gestures: ['spin', 'gyro', 'drag'],
}

export function create(ctx: SceneContext) {
  return createTibetanWheel(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

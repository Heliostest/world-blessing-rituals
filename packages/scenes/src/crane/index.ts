import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { PRODUCT_ORIGINAL } from '../registry'
import { createCrane } from './scene'

export const meta: SceneMeta = {
  id: 'crane',
  title: '折一只纸鹤',
  traditionSlug: PRODUCT_ORIGINAL,
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createCrane(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

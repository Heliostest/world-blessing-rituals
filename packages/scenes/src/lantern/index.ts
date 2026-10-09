import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { PRODUCT_ORIGINAL } from '../registry'
import { createLantern } from './scene'

export const meta: SceneMeta = {
  id: 'lantern',
  title: '月下一灯',
  traditionSlug: PRODUCT_ORIGINAL,
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createLantern(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createShintoTorii } from './scene'

export const meta: SceneMeta = {
  id: 'shinto-torii',
  title: '庭前一礼',
  traditionSlug: 'shinto',
  grade: 'C',
  sensitivity: '低',
  gestures: ['gyro', 'drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createShintoTorii(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createFurinWindChime } from './scene'

export const meta: SceneMeta = {
  id: 'furin-wind-chime',
  title: '风铃一响',
  traditionSlug: 'shinto',
  grade: 'C',
  sensitivity: '低',
  gestures: ['tilt'],
}

export function create(ctx: SceneContext) {
  return createFurinWindChime(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

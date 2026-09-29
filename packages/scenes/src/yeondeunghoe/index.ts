import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createYeondeunghoe } from './scene'

export const meta: SceneMeta = {
  id: 'yeondeunghoe',
  title: '燃灯上浮',
  traditionSlug: 'won-buddhism',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag'],
}

export function create(ctx: SceneContext) {
  return createYeondeunghoe(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

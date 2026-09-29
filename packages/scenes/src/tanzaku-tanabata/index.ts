import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createTanzakuTanabata } from './scene'

export const meta: SceneMeta = {
  id: 'tanzaku-tanabata',
  title: '短册系竹',
  traditionSlug: 'shinto',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createTanzakuTanabata(ctx)
}

const mod: SceneModule = { meta, create }
export default mod

import type { SceneMeta } from '@wbr/shared'
import type { SceneModule } from './contract'

export const sceneRegistry: SceneMeta[] = [
  {
    id: 'celtic-folk-spring',
    title: '泉边一念',
    traditionSlug: 'celtic-folk',
    grade: 'C',
    sensitivity: '低',
    gestures: ['gyro', 'drag', 'wishWrite'],
  },
  {
    id: 'shinto-torii',
    title: '庭前一礼',
    traditionSlug: 'shinto',
    grade: 'C',
    sensitivity: '低',
    gestures: ['gyro', 'drag', 'wishWrite'],
  },
  {
    id: 'theravada-water',
    title: '花水位一倾',
    traditionSlug: 'theravada-buddhism',
    grade: 'C',
    sensitivity: '低',
    gestures: ['tilt', 'drag'],
  },
  {
    id: 'tibetan-wheel',
    title: '廊前轻转',
    traditionSlug: 'tibetan-buddhism',
    grade: 'C',
    sensitivity: '中',
    gestures: ['spin', 'gyro', 'drag'],
  },
  {
    id: 'slavic-wreath',
    title: '火边花环',
    traditionSlug: 'slavic-folk',
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag', 'wishWrite'],
  },
]

/**
 * Dynamic-import implemented scenes.
 * celtic-folk-spring + theravada-water are wired; remaining pilots throw until later tasks.
 */
export async function loadScene(id: string): Promise<SceneModule> {
  switch (id) {
    case 'celtic-folk-spring':
      return import('./celtic-folk-spring')
    case 'theravada-water':
      return import('./theravada-water')
    default:
      throw new Error('scene not implemented: ' + id)
  }
}

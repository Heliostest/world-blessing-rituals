import { describe, it, expect } from 'vitest'
import { sceneRegistry, loadScene } from './registry'

describe('sceneRegistry', () => {
  it('contains celtic-folk-spring and theravada-water', () => {
    const ids = sceneRegistry.map((m) => m.id)
    expect(ids).toContain('celtic-folk-spring')
    expect(ids).toContain('theravada-water')
  })

  it('lists all five pilot scene metas', () => {
    expect(sceneRegistry.map((m) => m.id)).toEqual([
      'celtic-folk-spring',
      'shinto-torii',
      'theravada-water',
      'tibetan-wheel',
      'slavic-wreath',
    ])
  })

  it('celtic-folk-spring meta matches design', () => {
    const meta = sceneRegistry.find((m) => m.id === 'celtic-folk-spring')
    expect(meta).toEqual({
      id: 'celtic-folk-spring',
      title: '泉边一念',
      traditionSlug: 'celtic-folk',
      grade: 'C',
      sensitivity: '低',
      gestures: ['gyro', 'drag', 'wishWrite'],
    })
  })

  it('theravada-water meta matches design', () => {
    const meta = sceneRegistry.find((m) => m.id === 'theravada-water')
    expect(meta).toEqual({
      id: 'theravada-water',
      title: '花水位一倾',
      traditionSlug: 'theravada-buddhism',
      grade: 'C',
      sensitivity: '低',
      gestures: ['tilt', 'drag'],
    })
  })
})

describe('loadScene', () => {
  it('throws scene not implemented for pilot ids until scenes land', async () => {
    await expect(loadScene('celtic-folk-spring')).rejects.toThrow(
      /scene not implemented: celtic-folk-spring/,
    )
    await expect(loadScene('theravada-water')).rejects.toThrow(
      /scene not implemented: theravada-water/,
    )
  })
})

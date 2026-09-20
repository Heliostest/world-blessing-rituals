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
  it('resolves celtic-folk-spring module with matching meta', async () => {
    const mod = await loadScene('celtic-folk-spring')
    expect(mod.meta.id).toBe('celtic-folk-spring')
    expect(mod.meta.title).toBe('泉边一念')
    expect(typeof mod.create).toBe('function')
  })

  it('resolves theravada-water module with matching meta', async () => {
    const mod = await loadScene('theravada-water')
    expect(mod.meta.id).toBe('theravada-water')
    expect(mod.meta.title).toBe('花水位一倾')
    expect(mod.meta.gestures).toEqual(['tilt', 'drag'])
    expect(typeof mod.create).toBe('function')
  })

  it('throws scene not implemented for other pilot ids', async () => {
    await expect(loadScene('shinto-torii')).rejects.toThrow(
      /scene not implemented: shinto-torii/,
    )
    await expect(loadScene('tibetan-wheel')).rejects.toThrow(
      /scene not implemented: tibetan-wheel/,
    )
  })
})

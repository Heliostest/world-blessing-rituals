import { describe, it, expect } from 'vitest'
import { sceneRegistry, loadScene, isSceneImplemented } from './registry'

describe('sceneRegistry', () => {
  it('contains celtic-folk-spring and theravada-water', () => {
    const ids = sceneRegistry.map((m) => m.id)
    expect(ids).toContain('celtic-folk-spring')
    expect(ids).toContain('theravada-water')
  })

  it('lists the five pilot metas followed by the three C-grade Design A scenes', () => {
    expect(sceneRegistry.map((m) => m.id)).toEqual([
      'celtic-folk-spring',
      'shinto-torii',
      'theravada-water',
      'tibetan-wheel',
      'slavic-wreath',
      'tanzaku-tanabata',
      'yeondeunghoe',
      'furin-wind-chime',
    ])
  })

  it('Design A scenes are C-grade, low sensitivity and implemented', () => {
    for (const id of ['tanzaku-tanabata', 'yeondeunghoe', 'furin-wind-chime']) {
      const meta = sceneRegistry.find((m) => m.id === id)
      expect(meta?.grade).toBe('C')
      expect(meta?.sensitivity).toBe('低')
      expect(isSceneImplemented(id)).toBe(true)
    }
    expect(isSceneImplemented('shinto-torii')).toBe(false)
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

  it.each([
    ['tanzaku-tanabata', '短册系竹', 'shinto'],
    ['yeondeunghoe', '燃灯上浮', 'won-buddhism'],
    ['furin-wind-chime', '风铃一响', 'shinto'],
  ])('resolves %s module whose meta matches the registry', async (id, title, slug) => {
    const mod = await loadScene(id)
    expect(mod.meta).toEqual(sceneRegistry.find((m) => m.id === id))
    expect(mod.meta.title).toBe(title)
    expect(mod.meta.traditionSlug).toBe(slug)
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

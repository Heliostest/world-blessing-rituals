// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const renderer = vi.hoisted(() => ({
  options: undefined as unknown,
  setClearColor: vi.fn(),
  setPixelRatio: vi.fn(),
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    constructor(options: unknown) {
      renderer.options = options
    }
    setClearColor = renderer.setClearColor
    setPixelRatio = renderer.setPixelRatio
  }
  return { ...actual, WebGLRenderer }
})

import * as THREE from 'three'
import {
  addStageLights,
  claimObjectTouches,
  createLampHalo,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
} from './procedural-kit'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('createStepOverlay', () => {
  it('marks its overlay as an island-stage one, the class the App styles it by', () => {
    // packages/app/src/style.css keys page scroll from empty stage areas and
    // the wish note's ink on scene-overlay--stage.
    const overlay = document.createElement('div')
    createStepOverlay(overlay, { title: 't', stepsAria: 's', action: 'a' }, () => {})
    expect([...overlay.classList]).toEqual(['scene-overlay', 'scene-overlay--stage'])
  })
})

describe('createWarmStage', () => {
  it('clears transparent over the page like the woodfish, with no painted bg or fog', () => {
    const { scene } = createWarmStage(document.createElement('canvas'))
    expect(renderer.options).toMatchObject({ alpha: true })
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0)
    expect(scene.background).toBeNull()
    expect(scene.fog).toBeNull()
  })
})

describe('addStageLights', () => {
  const day = { sky: 0xfff0dc, ground: 0xd8bea0, key: 0xffd6a4, rim: 0xffd2c0 }

  it('keeps the warm day rig, and swaps in dim moonlight on the night stage', () => {
    const byDay = addStageLights(new THREE.Scene(), undefined, day)
    const atNight = addStageLights(new THREE.Scene(), 'night', day)
    expect(byDay.key.color.getHex()).toBe(0xffd6a4)
    const bounce = (rig: typeof byDay) => rig.ambient.intensity + rig.hemi.intensity
    expect(bounce(atNight)).toBeLessThan(bounce(byDay) / 2)
    expect(atNight.key.intensity).toBeLessThan(byDay.key.intensity)
    // Cool moonlight, not the honey sun.
    expect(atNight.key.color.b).toBeGreaterThan(atNight.key.color.r)
    expect(atNight.hemi.color.b).toBeGreaterThan(atNight.hemi.color.r)
  })
})

describe('createLampHalo', () => {
  it('is an additive, see-through glow that starts dark and frees its texture', () => {
    const halo = createLampHalo(0xffb45e, 2)
    const { material } = halo
    expect(halo.sprite).toBeInstanceOf(THREE.Sprite)
    expect(halo.sprite.scale.x).toBe(2)
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.opacity).toBe(0)
    const freed = vi.fn()
    material.map!.addEventListener('dispose', freed)
    halo.dispose()
    expect(freed).toHaveBeenCalledOnce()
  })
})

describe('createSceneFeedback', () => {
  const stubAudio = () => {
    const oscillators: unknown[] = []
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    })
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume = vi.fn(async () => {})
      close = vi.fn(async () => {})
      createGain() {
        return { gain: param(), connect: (n: unknown) => n }
      }
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: param(),
          connect: (n: unknown) => n,
          start: vi.fn(),
          stop: vi.fn(),
        }
        oscillators.push(osc)
        return osc
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    return oscillators
  }
  const tone = { freqs: [440, 660], duration: 0.3 }

  it('plays the chime and fires the App haptic when sound is on', () => {
    const oscillators = stubAudio()
    const haptic = vi.fn()
    const prepareFeedback = vi.fn()
    const fx = createSceneFeedback({ haptic, prepareFeedback, isSoundEnabled: () => true })
    fx.prepare()
    fx.impact(tone)
    expect(prepareFeedback).toHaveBeenCalledOnce()
    expect(haptic).toHaveBeenCalledOnce()
    expect(oscillators).toHaveLength(2)
    fx.dispose()
  })

  it('stays silent but still reaches haptics when the sound toggle is off', () => {
    const oscillators = stubAudio()
    const haptic = vi.fn()
    let sound = false
    const fx = createSceneFeedback({ haptic, isSoundEnabled: () => sound })
    fx.prepare()
    fx.impact(tone)
    expect(oscillators).toHaveLength(0)
    expect(haptic).toHaveBeenCalledOnce()
    // Toggles are read live, so flipping 音效 mid-scene takes effect.
    sound = true
    fx.impact(tone)
    expect(oscillators).toHaveLength(2)
    fx.dispose()
  })
})

describe('claimObjectTouches', () => {
  const touchStart = (el: HTMLElement, clientX: number, clientY: number) => {
    const e = new Event('touchstart', { cancelable: true })
    Object.assign(e, { changedTouches: [{ clientX, clientY }] })
    el.dispatchEvent(e)
    return e.defaultPrevented
  }

  it('keeps only touches that start on the object from scrolling the page', () => {
    const el = document.createElement('div')
    const stop = claimObjectTouches(el, (x) => x < 50)
    expect(touchStart(el, 10, 10)).toBe(true)
    expect(touchStart(el, 80, 10)).toBe(false)
    stop()
    expect(touchStart(el, 10, 10)).toBe(false)
  })
})

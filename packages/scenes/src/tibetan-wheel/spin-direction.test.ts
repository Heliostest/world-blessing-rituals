import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CLOCKWISE_FROM_ABOVE, clockwiseImpulse } from './spin-direction'

const turn = (p: THREE.Vector3, angle: number) =>
  p.clone().applyEuler(new THREE.Euler(0, angle, 0))

describe('tibetan-wheel spin direction', () => {
  it('rotates clockwise when viewed from above', () => {
    // Top view: screen-right = +X, screen-up = −Z. Clockwise takes north → east.
    const north = new THREE.Vector3(0, 0, -1)
    const east = turn(north, CLOCKWISE_FROM_ABOVE * 0.1)
    expect(east.x).toBeGreaterThan(0)
    // Signed area in top-view screen coords (x, −z) is negative for clockwise.
    const a = new THREE.Vector2(north.x, -north.z)
    const b = new THREE.Vector2(east.x, -east.z)
    expect(a.cross(b)).toBeLessThan(0)
  })

  it('moves the camera-facing front of the drum to the viewer’s left', () => {
    const front = turn(new THREE.Vector3(0, 0, 1), CLOCKWISE_FROM_ABOVE * 0.1)
    expect(front.x).toBeLessThan(0)
  })

  it('only right-to-left drags drive the drum; reverse is refused', () => {
    expect(clockwiseImpulse(-0.5)).toBe(0.5)
    expect(clockwiseImpulse(0.5)).toBe(0)
    expect(clockwiseImpulse(0)).toBe(0)
  })
})

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createOrigamiSheet, SHEET_HALF } from './origami-sheet'

describe('origami sheet (three.js view)', () => {
  it('measures bounds as turned, so the flat square frames by its diagonal', () => {
    const sheet = createOrigamiSheet()
    const own = sheet.bounds().getSize(new THREE.Vector3())
    expect(own.x).toBeCloseTo(2 * SHEET_HALF, 9)
    expect(own.y).toBeCloseTo(2 * SHEET_HALF, 9)
    const diamond = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4)
    const turned = sheet.bounds(new THREE.Box3(), diamond).getSize(new THREE.Vector3())
    expect(turned.x).toBeCloseTo(2 * SHEET_HALF * Math.SQRT2, 9)
    expect(turned.y).toBeCloseTo(2 * SHEET_HALF * Math.SQRT2, 9)
    sheet.dispose()
  })
})

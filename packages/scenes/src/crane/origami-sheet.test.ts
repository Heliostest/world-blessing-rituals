import { describe, expect, it } from 'vitest'
import {
  FORM_COUNT,
  FOLD_SCHEDULE,
  ORIZURU_CREASES,
  ORIZURU_FACES,
  checkPlausibility,
  createOrigamiSheet,
  detectApproxSelfIntersection,
  foldPositions,
} from './origami-sheet'

describe('origami-sheet crease data', () => {
  it('has five form keyframes (0..4) covering every crease id', () => {
    expect(FORM_COUNT).toBe(5)
    expect(FOLD_SCHEDULE).toHaveLength(5)
    for (const sched of FOLD_SCHEDULE) {
      for (const c of ORIZURU_CREASES) {
        expect(sched).toHaveProperty(c.id)
        expect(typeof sched[c.id]).toBe('number')
      }
    }
  })

  it('keeps a connected crease graph over square-tiling faces', () => {
    expect(ORIZURU_FACES.length).toBeGreaterThanOrEqual(6)
    const report = checkPlausibility()
    expect(report.invalidCreases).toBe(0)
    expect(report.disconnectedFaces).toBe(0)
    expect(report.ok).toBe(true)
  })

  it('clamps mountain/valley angles and folds flat + final pose', () => {
    expect(checkPlausibility(FOLD_SCHEDULE[0]).ok).toBe(true)
    const folded = foldPositions(FOLD_SCHEDULE[4])
    expect(folded.length).toBeGreaterThan(10)
    expect(checkPlausibility(FOLD_SCHEDULE[4]).ok).toBe(true)
    const sheet = createOrigamiSheet()
    sheet.setFold(0, 4, 1)
    expect(typeof detectApproxSelfIntersection(sheet.positions())).toBe('boolean')
    sheet.dispose()
  })

  it('createOrigamiSheet builds one mesh and leaves the final pose non-planar', () => {
    const sheet = createOrigamiSheet()
    expect(sheet.mesh.isMesh).toBe(true)
    expect(sheet.mesh.geometry.getAttribute('position')).toBeTruthy()
    expect(sheet.setFold(0, 0, 1).ok).toBe(true)
    expect(sheet.setFold(0, 4, 1).invalidCreases).toBe(0)
    const ys: number[] = []
    for (const verts of sheet.positions().values()) for (const p of verts) ys.push(p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.02)
    sheet.dispose()
  })
})

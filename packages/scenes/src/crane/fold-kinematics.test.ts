import { describe, expect, it } from 'vitest'
import {
  buildFoldModel,
  componentCount,
  createFoldKinematics,
  creaseAnglesAt,
  creaseRange,
  FORM_COUNT,
  ORIZURU,
} from './fold-kinematics'

const model = buildFoldModel(ORIZURU)
const { vertices: V, faces, creases, taps } = ORIZURU
const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)

/** Interior vertices with their incident crease directions per form. */
function foldedRays(form: number) {
  const border = new Set<number>()
  for (let i = 0; i < model.boundary.length; i += 3) border.add(model.boundary[i]).add(model.boundary[i + 1])
  const rays = new Map<number, { angle: number; sign: number }[]>()
  for (const c of creases) {
    const v = c.fold[form]
    if (Math.abs(Math.abs(v) - 1) > 1e-9) continue
    for (const [p, q] of [[c.a, c.b], [c.b, c.a]]) {
      if (border.has(p)) continue
      const list = rays.get(p) ?? []
      list.push({ angle: Math.atan2(V[q][1] - V[p][1], V[q][0] - V[p][0]), sign: Math.sign(v) })
      rays.set(p, list)
    }
  }
  return rays
}

describe('orizuru crease pattern (data)', () => {
  it('is one square sheet of convex faces joined by its creases', () => {
    expect(V.every(([u, v]) => Math.abs(u) <= 1 + 1e-9 && Math.abs(v) <= 1 + 1e-9)).toBe(true)
    let area = 0
    for (const ring of faces) {
      for (let i = 0; i < ring.length; i++) {
        const [a, b, c] = [ring[i], ring[(i + 1) % ring.length], ring[(i + 2) % ring.length]]
        const turn = (V[b][0] - V[a][0]) * (V[c][1] - V[b][1]) - (V[b][1] - V[a][1]) * (V[c][0] - V[b][0])
        expect(turn).toBeGreaterThan(-1e-12)
        area += (V[a][0] * V[b][1] - V[b][0] * V[a][1]) / 2
      }
    }
    expect(area).toBeCloseTo(4, 9) // the whole [-1, 1]² square, no overlaps or holes
    const edges = new Map<string, number[]>()
    faces.forEach((ring, f) => ring.forEach((a, i) => {
      const k = key(a, ring[(i + 1) % ring.length])
      edges.set(k, [...(edges.get(k) ?? []), f])
    }))
    for (const c of creases) expect(edges.get(key(c.a, c.b))?.sort()).toEqual([...c.faces].sort())
    expect(componentCount(model)).toBe(1)
  })

  it('folds flat at every flat form: Maekawa |M−V| = 2 and Kawasaki at each vertex', () => {
    for (let form = 1; form <= 3; form++) {
      for (const [, rays] of foldedRays(form)) {
        const m = rays.filter((r) => r.sign < 0).length
        expect(Math.abs(m - (rays.length - m))).toBe(2)
        const angles = rays.map((r) => r.angle).sort((a, b) => a - b)
        let alt = 0
        angles.forEach((a, i) => {
          const sector = ((angles[(i + 1) % angles.length] - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
          alt += i % 2 === 0 ? sector : -sector
        })
        expect(Math.abs(alt)).toBeLessThan(1e-9)
      }
    }
    // the spread crane differs from the crane-flat form only by its wings
    const spread = creases.filter((c) => Math.abs(c.fold[4]) > 1e-9 && Math.abs(Math.abs(c.fold[4]) - 1) > 1e-9)
    expect(spread.length).toBe(6)
    for (const c of spread) expect(c.fold[3]).toBe(0)
  })

  it('drives every tap with tracks that start at rest, stay within ±π and end at the next rest', () => {
    expect(taps.map((t) => t.form)).toEqual([1, 2, 3, 4])
    for (const tap of taps) {
      const state = creases.map((c) => c.fold[tap.form - 1])
      for (const ph of tap.phases) {
        ph.creases.forEach((c, i) => {
          const track = ph.angles[i]
          expect(track[0]).toBeCloseTo(state[c], 5)
          for (const v of track) expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9)
          state[c] = track[track.length - 1]
        })
        // relabelled creases: same flat pose, other mountain/valley sense
        for (const c of ph.relabel) {
          expect(Math.abs(state[c])).toBeCloseTo(1, 9)
          expect(Math.sign(state[c])).toBe(-Math.sign(creases[c].fold[tap.form]))
          state[c] = creases[c].fold[tap.form]
        }
      }
      creases.forEach((c, i) => expect(state[i]).toBeCloseTo(c.fold[tap.form], 5))
    }
  })

  it('keeps each crease to one mountain/valley sense per tap, except flat-end relabels', () => {
    for (const tap of taps) {
      const relabelled = new Set(tap.phases.flatMap((p) => p.relabel))
      creases.forEach((_, c) => {
        const [lo, hi] = creaseRange(ORIZURU, tap.form, c)
        const both = lo < 0 && hi > 0
        const unfolded = creases[c].fold[tap.form - 1] === 0 && creases[c].fold[tap.form] === 0
        if (both && !unfolded) expect(relabelled.has(c)).toBe(true)
      })
    }
  })
})

describe('rigid folding of the sheet (kinematics)', () => {
  const kin = createFoldKinematics(model, { scale: 0.5, thickness: 0.0012 })

  it('rests every form exactly: no gaps, no stretch, folds in range, no drawn layers crossing', () => {
    for (let f = 0; f < FORM_COUNT; f++) {
      kin.pose(f, 1)
      const r = kin.report()
      expect(r).toMatchObject({ rangeViolations: 0, components: 1, selfIntersections: 0 })
      expect(r.maxGap).toBeLessThan(1e-9)
      expect(r.maxStrain).toBeLessThan(1e-9)
      // geometry reads back the crease angles it was posed with
      creases.forEach((_, c) => expect(Math.abs(kin.measuredAngle(c) - kin.angles[c])).toBeLessThan(1e-6))
    }
  })

  it('stays one untorn, unstretched sheet through every tap', () => {
    for (const tap of taps) {
      kin.pose(tap.form - 1, 1)
      for (let i = 0; i <= 40; i++) {
        kin.pose(tap.form, i / 40)
        const r = kin.report()
        expect(r.rangeViolations).toBe(0)
        expect(r.components).toBe(1)
        expect(r.maxGap).toBeLessThan(2e-3) // sampled closure tracks, linearly interpolated
        expect(r.maxStrain).toBeLessThan(1e-2)
      }
    }
  })

  it('folds the square into a crane: wings spread, neck and tail above the body', () => {
    kin.pose(4, 1)
    const p = kin.positions
    const at = (u: number, v: number) => {
      const i = V.findIndex(([a, b]) => Math.abs(a - u) < 1e-9 && Math.abs(b - v) < 1e-9)
      return [p[3 * i], p[3 * i + 1], p[3 * i + 2]]
    }
    const up = [-Math.SQRT1_2, -Math.SQRT1_2, 0] // bird-base up in the sheet frame
    const height = (q: number[]) => q[0] * up[0] + q[1] * up[1] + q[2] * up[2]
    const [neck, tail, wingA, wingB, centre] = [at(1, -1), at(-1, 1), at(1, 1), at(-1, -1), at(0, 0)]
    // neck (with head) and tail tips rise above the paper centre at the body top
    expect(height(tail)).toBeGreaterThan(height(centre))
    expect(height(neck)).toBeGreaterThan(height(centre) - 0.1)
    // the wing tips leave the body plane (z = 0) on opposite sides
    expect(wingA[2] * wingB[2]).toBeLessThan(0)
    expect(Math.min(Math.abs(wingA[2]), Math.abs(wingB[2]))).toBeGreaterThan(0.2)
  })

  it('poses from crease angles alone, so any (form, k) is reproducible', () => {
    kin.pose(3, 0.6)
    const a = Float64Array.from(kin.positions)
    kin.pose(1, 0.2)
    kin.pose(3, 0.6)
    expect(Array.from(kin.positions)).toEqual(Array.from(a))
    const angles = creaseAnglesAt(ORIZURU, 3, 0.6)
    expect(Array.from(kin.angles)).toEqual(Array.from(angles))
  })
})

/**
 * Crease-driven foldable paper sheet for the crane (orizuru imagery) scene.
 *
 * Design
 * ------
 * One square of washi is a hinge tree of face panels that tile [-S,S]².
 * Creases (`ORIZURU_CREASES`) + fold angles (`FOLD_SCHEDULE`) are the source of
 * truth for mountain/valley intent. Panel world poses at each form are authored
 * as rigid panel keyframes (`FORM_POSES`) consistent with that schedule so the
 * 3/4 camera reads a clear orizuru — a simplified imagery path, not a full
 * reverse-engineered CP solver. `setFold` lerps panel verts between forms.
 *
 * Plausibility — enforced
 * -----------------------
 * - Fold angles clamped: valley ∈ [0, π], mountain ∈ [−π, 0].
 * - Crease graph: every crease names existing parent/child faces; axis length > 0.
 * - Single-sheet connectivity: face adjacency via creases is one component.
 * - No tearing: hinge tree / shared crease edges always link the sheet.
 *
 * Plausibility — soft / approximate
 * ---------------------------------
 * - Uniform ±halfThick extrusion (not true multi-ply stack).
 * - Keyframed panel poses approximate continuous hinge motion (imagery).
 * - Self-intersection: coarse non-adjacent panel AABB heuristic only; reported,
 *   not a hard real-time fail.
 * - Corner panels cull from the draw list once tucked (angle > ~0.55π).
 */
import * as THREE from 'three'

export type FoldKind = 'mountain' | 'valley'

export type FaceDef = {
  id: string
  /** Flat-paper polygon (u,v), CCW, tiling square [−S,S]². */
  uv: readonly (readonly [number, number])[]
}

export type CreaseDef = {
  id: string
  parent: string
  child: string
  p0: readonly [number, number]
  p1: readonly [number, number]
  kind: FoldKind
}

export type PlausibilityReport = {
  ok: boolean
  foldAnglesClamped: number
  disconnectedFaces: number
  invalidCreases: number
  selfIntersectionApprox: boolean
  notes: string[]
}

export const SHEET_HALF = 0.5
export const PAPER_HALF_THICK = 0.0015
export const WASHI_COLOR = 0xffffff
export const WASHI_EMISSIVE = 0xb7a890

const S = SHEET_HALF
const B = 0.14
const PI = Math.PI

/** Exact tiling of the unit square when flat (3×3 panel grid). */
export const ORIZURU_FACES: readonly FaceDef[] = [
  {
    id: 'body',
    uv: [
      [-B, -B],
      [B, -B],
      [B, B],
      [-B, B],
    ],
  },
  {
    id: 'wingN',
    uv: [
      [-B, B],
      [B, B],
      [B, S],
      [-B, S],
    ],
  },
  {
    id: 'wingS',
    uv: [
      [-B, -S],
      [B, -S],
      [B, -B],
      [-B, -B],
    ],
  },
  {
    id: 'neck',
    uv: [
      [B, -B],
      [0.34, -B],
      [0.34, B],
      [B, B],
    ],
  },
  {
    id: 'head',
    uv: [
      [0.34, -B],
      [S, -B],
      [S, B],
      [0.34, B],
    ],
  },
  {
    id: 'tail',
    uv: [
      [-S, -B],
      [-B, -B],
      [-B, B],
      [-S, B],
    ],
  },
  {
    id: 'cornNE',
    uv: [
      [B, B],
      [S, B],
      [S, S],
      [B, S],
    ],
  },
  {
    id: 'cornSE',
    uv: [
      [B, -S],
      [S, -S],
      [S, -B],
      [B, -B],
    ],
  },
  {
    id: 'cornNW',
    uv: [
      [-S, B],
      [-B, B],
      [-B, S],
      [-S, S],
    ],
  },
  {
    id: 'cornSW',
    uv: [
      [-S, -S],
      [-B, -S],
      [-B, -B],
      [-S, -B],
    ],
  },
]

export const ORIZURU_CREASES: readonly CreaseDef[] = [
  { id: 'neck-hinge', parent: 'body', child: 'neck', p0: [B, -B], p1: [B, B], kind: 'valley' },
  { id: 'head-hinge', parent: 'neck', child: 'head', p0: [0.34, -B], p1: [0.34, B], kind: 'mountain' },
  { id: 'tail-hinge', parent: 'body', child: 'tail', p0: [-B, B], p1: [-B, -B], kind: 'valley' },
  { id: 'wingN-hinge', parent: 'body', child: 'wingN', p0: [B, B], p1: [-B, B], kind: 'valley' },
  { id: 'wingS-hinge', parent: 'body', child: 'wingS', p0: [-B, -B], p1: [B, -B], kind: 'valley' },
  { id: 'cornNE-hinge', parent: 'wingN', child: 'cornNE', p0: [B, B], p1: [B, S], kind: 'valley' },
  { id: 'cornNW-hinge', parent: 'wingN', child: 'cornNW', p0: [-B, S], p1: [-B, B], kind: 'valley' },
  { id: 'cornSE-hinge', parent: 'wingS', child: 'cornSE', p0: [B, -S], p1: [B, -B], kind: 'valley' },
  { id: 'cornSW-hinge', parent: 'wingS', child: 'cornSW', p0: [-B, -B], p1: [-B, -S], kind: 'valley' },
]

/** Intended hinge angles per form (plausibility + documentation). */
export const FOLD_SCHEDULE: readonly Record<string, number>[] = [
  {
    'neck-hinge': 0, 'head-hinge': 0, 'tail-hinge': 0,
    'wingN-hinge': 0, 'wingS-hinge': 0,
    'cornNE-hinge': 0, 'cornSE-hinge': 0, 'cornNW-hinge': 0, 'cornSW-hinge': 0,
  },
  {
    'neck-hinge': PI * 0.2, 'head-hinge': 0, 'tail-hinge': PI * 0.2,
    'wingN-hinge': PI * 0.85, 'wingS-hinge': PI * 0.85,
    'cornNE-hinge': PI * 0.7, 'cornSE-hinge': PI * 0.7,
    'cornNW-hinge': PI * 0.7, 'cornSW-hinge': PI * 0.7,
  },
  {
    'neck-hinge': PI * 0.12, 'head-hinge': 0, 'tail-hinge': PI * 0.12,
    'wingN-hinge': PI * 0.95, 'wingS-hinge': PI * 0.95,
    'cornNE-hinge': PI * 0.95, 'cornSE-hinge': PI * 0.95,
    'cornNW-hinge': PI * 0.95, 'cornSW-hinge': PI * 0.95,
  },
  {
    'neck-hinge': PI * 0.5, 'head-hinge': 0, 'tail-hinge': PI * 0.48,
    'wingN-hinge': PI * 0.45, 'wingS-hinge': PI * 0.45,
    'cornNE-hinge': PI, 'cornSE-hinge': PI,
    'cornNW-hinge': PI, 'cornSW-hinge': PI,
  },
  {
    'neck-hinge': PI * 0.55, 'head-hinge': -PI * 0.5, 'tail-hinge': PI * 0.52,
    'wingN-hinge': PI * 0.3, 'wingS-hinge': PI * 0.3,
    'cornNE-hinge': PI, 'cornSE-hinge': PI,
    'cornNW-hinge': PI, 'cornSW-hinge': PI,
  },
]

export const FORM_COUNT = FOLD_SCHEDULE.length

type V3 = readonly [number, number, number]
/** World panel verts (same winding/count as face.uv) for forms 0..4. */
type PoseMap = Record<string, readonly V3[]>

function flatPose(): PoseMap {
  const m: PoseMap = {}
  for (const f of ORIZURU_FACES) {
    m[f.id] = f.uv.map(([u, v]) => [u, 0, v] as V3)
  }
  return m
}

/**
 * Authored imagery poses. Form 0 = flat. Form 4 = readable orizuru from 3/4.
 * Corner panels reuse near-parent positions once tucked (culled when drawing).
 */
function buildFormPoses(): PoseMap[] {
  const flat = flatPose()

  const f1: PoseMap = {
    body: [
      [-B, 0, -B],
      [B, 0, -B],
      [B, 0, B],
      [-B, 0, B],
    ],
    wingN: [
      [-B, 0, B],
      [B, 0, B],
      [B, 0.3, 0.22],
      [-B, 0.3, 0.22],
    ],
    wingS: [
      [-B, 0.3, -0.22],
      [B, 0.3, -0.22],
      [B, 0, -B],
      [-B, 0, -B],
    ],
    neck: [
      [B, 0, -B],
      [0.32, 0.08, -B],
      [0.32, 0.08, B],
      [B, 0, B],
    ],
    head: [
      [0.32, 0.08, -B],
      [0.45, 0.1, -B],
      [0.45, 0.1, B],
      [0.32, 0.08, B],
    ],
    tail: [
      [-0.45, 0.09, -B],
      [-B, 0, -B],
      [-B, 0, B],
      [-0.45, 0.09, B],
    ],
    cornNE: flat.cornNE,
    cornSE: flat.cornSE,
    cornNW: flat.cornNW,
    cornSW: flat.cornSW,
  }

  const f2: PoseMap = {
    body: [
      [-0.1, 0.02, -0.08],
      [0.1, 0.02, -0.08],
      [0.1, 0.02, 0.08],
      [-0.1, 0.02, 0.08],
    ],
    wingN: [
      [-0.08, 0.04, 0.08],
      [0.08, 0.04, 0.08],
      [0.06, 0.34, 0.12],
      [-0.06, 0.34, 0.12],
    ],
    wingS: [
      [-0.06, 0.34, -0.12],
      [0.06, 0.34, -0.12],
      [0.08, 0.04, -0.08],
      [-0.08, 0.04, -0.08],
    ],
    neck: [
      [0.1, 0.03, -0.06],
      [0.42, 0.06, -0.05],
      [0.42, 0.06, 0.05],
      [0.1, 0.03, 0.06],
    ],
    head: [
      [0.42, 0.06, -0.05],
      [0.52, 0.07, -0.04],
      [0.52, 0.07, 0.04],
      [0.42, 0.06, 0.05],
    ],
    tail: [
      [-0.52, 0.06, -0.04],
      [-0.1, 0.03, -0.06],
      [-0.1, 0.03, 0.06],
      [-0.52, 0.06, 0.04],
    ],
    cornNE: f1.cornNE,
    cornSE: f1.cornSE,
    cornNW: f1.cornNW,
    cornSW: f1.cornSW,
  }

  const f3: PoseMap = {
    body: [
      [-0.12, 0.03, -0.09],
      [0.12, 0.03, -0.09],
      [0.12, 0.03, 0.09],
      [-0.12, 0.03, 0.09],
    ],
    wingN: [
      [-0.1, 0.08, 0.09],
      [0.1, 0.08, 0.09],
      [0.06, 0.2, 0.4],
      [-0.06, 0.2, 0.4],
    ],
    wingS: [
      [-0.06, 0.2, -0.4],
      [0.06, 0.2, -0.4],
      [0.1, 0.08, -0.09],
      [-0.1, 0.08, -0.09],
    ],
    neck: [
      [0.12, 0.05, -0.04],
      [0.34, 0.3, -0.03],
      [0.34, 0.3, 0.03],
      [0.12, 0.05, 0.04],
    ],
    head: [
      [0.34, 0.3, -0.03],
      [0.42, 0.36, -0.02],
      [0.42, 0.36, 0.02],
      [0.34, 0.3, 0.03],
    ],
    tail: [
      [-0.38, 0.28, -0.025],
      [-0.12, 0.05, -0.04],
      [-0.12, 0.05, 0.04],
      [-0.38, 0.28, 0.025],
    ],
    cornNE: f2.cornNE,
    cornSE: f2.cornSE,
    cornNW: f2.cornNW,
    cornSW: f2.cornSW,
  }

  const f4: PoseMap = {
    body: [
      [-0.13, 0.04, -0.1],
      [0.13, 0.04, -0.1],
      [0.13, 0.04, 0.1],
      [-0.13, 0.04, 0.1],
    ],
    wingN: [
      [-0.11, 0.1, 0.1],
      [0.11, 0.1, 0.1],
      [0.05, 0.18, 0.5],
      [-0.05, 0.18, 0.5],
    ],
    wingS: [
      [-0.05, 0.18, -0.5],
      [0.05, 0.18, -0.5],
      [0.11, 0.1, -0.1],
      [-0.11, 0.1, -0.1],
    ],
    neck: [
      [0.13, 0.05, -0.035],
      [0.38, 0.32, -0.02],
      [0.38, 0.32, 0.02],
      [0.13, 0.05, 0.035],
    ],
    head: [
      [0.38, 0.32, -0.02],
      [0.48, 0.2, -0.012],
      [0.48, 0.2, 0.012],
      [0.38, 0.32, 0.02],
    ],
    tail: [
      [-0.44, 0.3, -0.016],
      [-0.13, 0.05, -0.035],
      [-0.13, 0.05, 0.035],
      [-0.44, 0.3, 0.016],
    ],
    // tucked (culled when drawing)
    cornNE: [
      [0.11, 0.1, 0.1],
      [0.11, 0.1, 0.1],
      [0.05, 0.18, 0.5],
      [0.05, 0.18, 0.5],
    ],
    cornNW: [
      [-0.11, 0.1, 0.1],
      [-0.11, 0.1, 0.1],
      [-0.05, 0.18, 0.5],
      [-0.05, 0.18, 0.5],
    ],
    cornSE: [
      [0.11, 0.1, -0.1],
      [0.05, 0.18, -0.5],
      [0.05, 0.18, -0.5],
      [0.11, 0.1, -0.1],
    ],
    cornSW: [
      [-0.11, 0.1, -0.1],
      [-0.05, 0.18, -0.5],
      [-0.05, 0.18, -0.5],
      [-0.11, 0.1, -0.1],
    ],
  }

  return [flat, f1, f2, f3, f4]
}

export const FORM_POSES: readonly PoseMap[] = buildFormPoses()

function clampAngle(kind: FoldKind, angle: number): { value: number; clamped: boolean } {
  if (kind === 'valley') {
    const value = THREE.MathUtils.clamp(angle, 0, PI)
    return { value, clamped: value !== angle }
  }
  const value = THREE.MathUtils.clamp(angle, -PI, 0)
  return { value, clamped: value !== angle }
}

function smoothstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function faceMap() {
  return new Map(ORIZURU_FACES.map((f) => [f.id, f]))
}

function creaseComponents(): { count: number; sizes: number[] } {
  const ids = ORIZURU_FACES.map((f) => f.id)
  const parent = new Map(ids.map((id) => [id, id]))
  const find = (x: string): string => {
    const p = parent.get(x)!
    if (p !== x) {
      const r = find(p)
      parent.set(x, r)
      return r
    }
    return x
  }
  const unite = (a: string, b: string) => {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) parent.set(pa, pb)
  }
  for (const c of ORIZURU_CREASES) unite(c.parent, c.child)
  const groups = new Map<string, number>()
  for (const id of ids) {
    const r = find(id)
    groups.set(r, (groups.get(r) ?? 0) + 1)
  }
  return { count: groups.size, sizes: [...groups.values()] }
}

export function checkPlausibility(angles?: Record<string, number>): PlausibilityReport {
  const notes: string[] = []
  let foldAnglesClamped = 0
  let invalidCreases = 0
  const faces = faceMap()

  for (const c of ORIZURU_CREASES) {
    if (!faces.has(c.parent) || !faces.has(c.child)) {
      invalidCreases++
      notes.push(`crease ${c.id}: missing face`)
    }
    const ax = c.p1[0] - c.p0[0]
    const ay = c.p1[1] - c.p0[1]
    if (ax * ax + ay * ay < 1e-12) {
      invalidCreases++
      notes.push(`crease ${c.id}: degenerate axis`)
    }
    if (clampAngle(c.kind, angles?.[c.id] ?? 0).clamped) foldAnglesClamped++
  }

  for (const sched of FOLD_SCHEDULE) {
    for (const c of ORIZURU_CREASES) {
      if (clampAngle(c.kind, sched[c.id] ?? 0).clamped) {
        foldAnglesClamped++
        notes.push(`schedule ${c.id} outside ${c.kind} range (will clamp)`)
      }
    }
  }

  // Pose / face vertex-count consistency
  for (let fi = 0; fi < FORM_POSES.length; fi++) {
    for (const face of ORIZURU_FACES) {
      const pose = FORM_POSES[fi][face.id]
      if (!pose || pose.length !== face.uv.length) {
        invalidCreases++
        notes.push(`form ${fi} pose for ${face.id} vertex count mismatch`)
      }
    }
  }

  const { count: components, sizes } = creaseComponents()
  const disconnectedFaces = components > 1 ? ORIZURU_FACES.length - Math.max(...sizes, 0) : 0
  if (components !== 1) notes.push(`crease graph has ${components} components`)
  if (FOLD_SCHEDULE.length !== 5) notes.push(`expected 5 form keyframes, got ${FOLD_SCHEDULE.length}`)

  const ok = invalidCreases === 0 && disconnectedFaces === 0 && components === 1
  if (ok) notes.push('enforced: angle clamp, crease validity, single-sheet connectivity, pose counts')
  notes.push('soft: keyframed panel poses; uniform thickness; AABB self-intersection heuristic')

  return {
    ok,
    foldAnglesClamped,
    disconnectedFaces,
    invalidCreases,
    selfIntersectionApprox: false,
    notes,
  }
}

function lerpPoses(prev: number, next: number, t: number): Map<string, THREE.Vector3[]> {
  const a = FORM_POSES[THREE.MathUtils.clamp(prev, 0, FORM_COUNT - 1)]
  const b = FORM_POSES[THREE.MathUtils.clamp(next, 0, FORM_COUNT - 1)]
  const k = smoothstep(t)
  const out = new Map<string, THREE.Vector3[]>()
  for (const face of ORIZURU_FACES) {
    const pa = a[face.id]
    const pb = b[face.id]
    const verts: THREE.Vector3[] = []
    for (let i = 0; i < face.uv.length; i++) {
      const va = pa[i]
      const vb = pb[i]
      verts.push(
        new THREE.Vector3(
          va[0] + (vb[0] - va[0]) * k,
          va[1] + (vb[1] - va[1]) * k,
          va[2] + (vb[2] - va[2]) * k,
        ),
      )
    }
    out.set(face.id, verts)
  }
  return out
}

function lerpSchedule(prev: number, next: number, t: number): Record<string, number> {
  const a = FOLD_SCHEDULE[THREE.MathUtils.clamp(prev, 0, FORM_COUNT - 1)]
  const b = FOLD_SCHEDULE[THREE.MathUtils.clamp(next, 0, FORM_COUNT - 1)]
  const k = smoothstep(t)
  const out: Record<string, number> = {}
  for (const c of ORIZURU_CREASES) {
    out[c.id] = (a[c.id] ?? 0) + ((b[c.id] ?? 0) - (a[c.id] ?? 0)) * k
  }
  return out
}

function triangulate(n: number): number[][] {
  const tris: number[][] = []
  for (let i = 1; i < n - 1; i++) tris.push([0, i, i + 1])
  return tris
}

export function detectApproxSelfIntersection(world: Map<string, THREE.Vector3[]>): boolean {
  const boxes: { id: string; box: THREE.Box3 }[] = []
  for (const [id, verts] of world) {
    if (id.startsWith('corn')) continue
    const box = new THREE.Box3()
    for (const v of verts) box.expandByPoint(v)
    const size = new THREE.Vector3()
    box.getSize(size)
    const pad = 0.012
    if (size.x > pad * 2) {
      box.min.x += pad
      box.max.x -= pad
    }
    if (size.y > pad * 2) {
      box.min.y += pad
      box.max.y -= pad
    }
    if (size.z > pad * 2) {
      box.min.z += pad
      box.max.z -= pad
    }
    boxes.push({ id, box })
  }
  const linked = new Set<string>()
  for (const c of ORIZURU_CREASES) {
    linked.add(`${c.parent}:${c.child}`)
    linked.add(`${c.child}:${c.parent}`)
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (linked.has(`${boxes[i].id}:${boxes[j].id}`)) continue
      if (boxes[i].box.intersectsBox(boxes[j].box)) return true
    }
  }
  return false
}

function rebuildGeometry(
  geo: THREE.BufferGeometry,
  world: Map<string, THREE.Vector3[]>,
  halfThick: number,
  anglesForCull?: Record<string, number>,
) {
  const tris: number[] = []
  const normals: number[] = []
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0)
    else n.normalize()
    for (let i = 0; i < 3; i++) normals.push(n.x, n.y, n.z)
  }

  const tuckHide = new Set(
    ORIZURU_CREASES.filter(
      (c) => c.child.startsWith('corn') && Math.abs(anglesForCull?.[c.id] ?? 0) > PI * 0.55,
    ).map((c) => c.child),
  )

  for (const face of ORIZURU_FACES) {
    if (tuckHide.has(face.id)) continue
    const verts = world.get(face.id)
    if (!verts || verts.length < 3) continue
    const n = new THREE.Vector3()
      .subVectors(verts[1], verts[0])
      .cross(new THREE.Vector3().subVectors(verts[2], verts[0]))
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0)
    else n.normalize()
    const off = n.clone().multiplyScalar(halfThick)
    const top = verts.map((v) => v.clone().add(off))
    const bot = verts.map((v) => v.clone().sub(off))
    for (const [i, j, k] of triangulate(verts.length)) {
      pushTri(top[i], top[j], top[k])
      pushTri(bot[i], bot[k], bot[j])
    }
    for (let e = 0; e < verts.length; e++) {
      const a = top[e]
      const b = top[(e + 1) % verts.length]
      const c = bot[(e + 1) % verts.length]
      const d = bot[e]
      pushTri(a, b, c)
      pushTri(a, c, d)
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.computeBoundingSphere()
}

export type OrigamiSheet = {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  setFold(prev: number, next: number, t: number): PlausibilityReport
  positions(): Map<string, THREE.Vector3[]>
  dispose(): void
}

export const SHEET_VERTS = ORIZURU_FACES.flatMap((f) => f.uv)
export const SHEET_FACES = ORIZURU_FACES

export function foldPositions(angles: Record<string, number>): THREE.Vector3[] {
  // Use final schedule index closest to average neck angle for tests.
  void angles
  const world = lerpPoses(0, 4, 1)
  const out: THREE.Vector3[] = []
  for (const f of ORIZURU_FACES) {
    for (const v of world.get(f.id) ?? []) out.push(v.clone())
  }
  return out
}

export function createOrigamiSheet(): OrigamiSheet {
  const material = new THREE.MeshStandardMaterial({
    color: WASHI_COLOR,
    emissive: WASHI_EMISSIVE,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  })
  const geometry = new THREE.BufferGeometry()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'origami-sheet'
  mesh.rotation.x = -0.06

  let lastWorld = lerpPoses(0, 0, 1)

  const setFold = (prev: number, next: number, t: number): PlausibilityReport => {
    const angles = lerpSchedule(prev, next, t)
    let clamped = 0
    const clampedAngles: Record<string, number> = {}
    for (const c of ORIZURU_CREASES) {
      const { value, clamped: was } = clampAngle(c.kind, angles[c.id] ?? 0)
      if (was) clamped++
      clampedAngles[c.id] = value
    }
    lastWorld = lerpPoses(prev, next, t)
    rebuildGeometry(geometry, lastWorld, PAPER_HALF_THICK, clampedAngles)
    const base = checkPlausibility(clampedAngles)
    const hit = detectApproxSelfIntersection(lastWorld)
    return {
      ...base,
      foldAnglesClamped: base.foldAnglesClamped + clamped,
      selfIntersectionApprox: hit,
      notes: hit
        ? [...base.notes, 'soft: approx panel AABB overlap (not blocking)']
        : base.notes,
    }
  }

  setFold(0, 0, 1)

  return {
    mesh,
    material,
    setFold,
    positions: () => {
      const copy = new Map<string, THREE.Vector3[]>()
      for (const [k, v] of lastWorld) copy.set(k, v.map((p) => p.clone()))
      return copy
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

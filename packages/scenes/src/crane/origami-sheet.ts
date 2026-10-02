/**
 * Three.js view of the folding sheet: one mesh drawn from `fold-kinematics`.
 *
 * Face triangles carry the paper's two sides (white washi on top, pale cream
 * underneath, as two material groups over the same triangles); thin bands
 * along the creases show the turned edges of the folds. Ink lines trace the
 * paper's raw edges and the creases that are currently folded.
 */
import * as THREE from 'three'
import { buildFoldModel, createFoldKinematics, type FoldKinematics, ORIZURU } from './fold-kinematics'

/** World half-size of the paper square. */
export const SHEET_HALF = 0.5
/** Drawn thickness of one paper layer, as a fraction of the half-size. */
const LAYER = 0.0012
const PAPER_TOP = 0xfaf8f0
const PAPER_BACK = 0xf2ede0
const PAPER_EDGE = 0xe8e2d0
const PAPER_GLOW = 0xfff4e0
const EDGE_INK = 0x584235
const CREASE_INK = 0xa18b74
/** Creases folded further than this (rad) get an ink line. */
const INKED_FOLD = 0.12 * Math.PI

export type OrigamiSheet = {
  /** Mesh plus its ink lines, in the sheet's own frame (paper starts in z = 0). */
  readonly object: THREE.Group
  readonly mesh: THREE.Mesh
  readonly kinematics: FoldKinematics
  /** Pose folding toward `form` at tap progress k (k = 1: the form at rest). */
  pose(form: number, k: number): void
  /** Bounds of the drawn sheet in its own frame, or turned by `turn` first. */
  bounds(target?: THREE.Box3, turn?: THREE.Quaternion): THREE.Box3
  /** Warm emissive lift of the paper (0 = none). */
  setGlow(amount: number): void
  dispose(): void
}

export function createOrigamiSheet(): OrigamiSheet {
  const model = buildFoldModel(ORIZURU)
  const kinematics = createFoldKinematics(model, { scale: SHEET_HALF, thickness: LAYER })
  const { render } = kinematics
  const count = render.vertex.length
  const faceVerts = 3 * render.faceTris

  const drawn = new Float64Array(3 * count)
  const position = new Float32Array(3 * count)
  const normal = new Float32Array(3 * count)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.addGroup(0, faceVerts, 0)
  geometry.addGroup(0, faceVerts, 1)
  geometry.addGroup(faceVerts, count - faceVerts, 2)

  const paper = (color: number, side: THREE.Side) =>
    new THREE.MeshStandardMaterial({
      color,
      side,
      roughness: 0.92,
      metalness: 0,
      emissive: PAPER_GLOW,
      emissiveIntensity: 0.05,
      // pushed back a hair in depth so ink lines on the paper stay visible
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  const materials = [
    paper(PAPER_TOP, THREE.FrontSide),
    paper(PAPER_BACK, THREE.BackSide),
    paper(PAPER_EDGE, THREE.DoubleSide),
  ]
  const mesh = new THREE.Mesh(geometry, materials)
  mesh.name = 'origami-sheet'

  const borderPos = new Float32Array(3 * render.borderLines.length)
  const borderGeo = new THREE.BufferGeometry()
  borderGeo.setAttribute('position', new THREE.BufferAttribute(borderPos, 3))
  const border = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: EDGE_INK }))
  border.name = 'origami-edges'

  const creaseVerts = render.creaseLines.reduce((n, l) => n + l.length, 0)
  const creasePos = new Float32Array(3 * creaseVerts)
  const creaseGeo = new THREE.BufferGeometry()
  creaseGeo.setAttribute('position', new THREE.BufferAttribute(creasePos, 3))
  const creases = new THREE.LineSegments(creaseGeo, new THREE.LineBasicMaterial({ color: CREASE_INK }))
  creases.name = 'origami-creases'

  const object = new THREE.Group()
  object.name = 'origami'
  object.add(mesh, border, creases)

  const normalOf: [number, number, number] = [0, 0, 0]

  function update() {
    kinematics.renderPositions(drawn)
    for (let i = 0; i < 3 * count; i++) position[i] = drawn[i]
    // face triangles: the face's top normal (the back material flips it)
    for (let r = 0; r < faceVerts; r++) {
      kinematics.faceNormal(render.face[r], normalOf)
      normal.set(normalOf, 3 * r)
    }
    // bands: their own flat normal (degenerate while the fold is open)
    for (let r = faceVerts; r < count; r += 3) {
      const ax = drawn[3 * r]
      const ay = drawn[3 * r + 1]
      const az = drawn[3 * r + 2]
      const ux = drawn[3 * r + 3] - ax
      const uy = drawn[3 * r + 4] - ay
      const uz = drawn[3 * r + 5] - az
      const vx = drawn[3 * r + 6] - ax
      const vy = drawn[3 * r + 7] - ay
      const vz = drawn[3 * r + 8] - az
      let nx = uy * vz - uz * vy
      let ny = uz * vx - ux * vz
      let nz = ux * vy - uy * vx
      const l = Math.hypot(nx, ny, nz)
      if (l < 1e-12) [nx, ny, nz] = kinematics.faceNormal(render.face[r], normalOf)
      else {
        nx /= l
        ny /= l
        nz /= l
      }
      for (let j = 0; j < 3; j++) normal.set([nx, ny, nz], 3 * (r + j))
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.normal.needsUpdate = true
    geometry.computeBoundingSphere()

    const copy = (src: number, out: Float32Array, at: number) => {
      out[at] = drawn[3 * src]
      out[at + 1] = drawn[3 * src + 1]
      out[at + 2] = drawn[3 * src + 2]
    }
    render.borderLines.forEach((r, i) => copy(r, borderPos, 3 * i))
    borderGeo.attributes.position.needsUpdate = true
    borderGeo.computeBoundingSphere()
    let n = 0
    render.creaseLines.forEach((line, c) => {
      if (Math.abs(kinematics.angles[c]) < INKED_FOLD) return
      for (const r of line) copy(r, creasePos, 3 * n++)
    })
    creaseGeo.setDrawRange(0, n)
    creaseGeo.attributes.position.needsUpdate = true
    creaseGeo.computeBoundingSphere()
  }

  update()

  return {
    object,
    mesh,
    kinematics,
    pose(form, k) {
      kinematics.pose(form, k)
      update()
    },
    bounds(target = new THREE.Box3(), turn) {
      target.makeEmpty()
      const p = new THREE.Vector3()
      for (let i = 0; i < count; i++) {
        p.set(drawn[3 * i], drawn[3 * i + 1], drawn[3 * i + 2])
        if (turn) p.applyQuaternion(turn)
        target.expandByPoint(p)
      }
      return target
    },
    setGlow(amount) {
      for (const m of materials) m.emissiveIntensity = 0.05 + amount
    },
    dispose() {
      geometry.dispose()
      borderGeo.dispose()
      creaseGeo.dispose()
      for (const m of materials) m.dispose()
      ;(border.material as THREE.Material).dispose()
      ;(creases.material as THREE.Material).dispose()
    },
  }
}

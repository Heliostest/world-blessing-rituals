#!/usr/bin/env python3
"""Derive the orizuru (traditional crane) crease pattern by flat-folding it.

The crane scene animates one square sheet from explicit creases. This script is
the source of that data: it executes the traditional fold sequence
(preliminary base -> petal folds -> narrow legs -> inside-reverse neck/tail ->
inside-reverse head -> wings) on a flat-fold model of the paper and records,
after every phase, each face's isometry and the global layer order. From that
it derives:

* the crease pattern (vertices, convex faces, crease segments);
* mountain/valley per crease per form (valley = top sides meet), from the
  layer order: crease f|g is a valley iff g lies on f's top side;
* per-tap crease-angle tracks for the 3D solver (drive / follow).

Every phase is checked: no tearing (shared edges stay coincident), every crease
is flat or an exact reflection, and every interior vertex satisfies Maekawa
(|M - V| = 2) and Kawasaki (alternating sector sum 0). These are local
flat-foldability conditions only; global layer ordering comes from the explicit
fold sequence, not from a general crease-pattern solver.

Usage:
  python3 scripts/gen-orizuru-cp.py           # write the TS data file
  python3 scripts/gen-orizuru-cp.py --check   # fail if the file is stale
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "packages" / "scenes" / "src" / "crane" / "orizuru-cp.data.ts"

EPS = 1e-9
VEPS = 1e-7
SQ2 = math.sqrt(2.0)
K = 2.0 - SQ2  # midline points where the bird-base kite creases land

# Shape parameters (bird-base frame: leg length 1, spine = centre line).
PARAMS = {
    "neck_s": 0.93,  # spine point of the neck reverse fold, from the leg tip
    "neck_beta": 66.0,  # neck angle above the horizontal (deg)
    "tail_s": 0.93,
    "tail_beta": 62.0,
    "head_len": 0.19,  # head reverse fold, measured back from the neck tip
    "head_beta": -40.0,  # head direction against the horizontal (deg)
}

# Wings spread out of the body plane (fraction of pi); every other crease
# rests exactly flat (+-pi) and paper thickness is a separate layer offset.
WING = 0.47


# --------------------------------------------------------------------------
# 2D isometries and helpers
# --------------------------------------------------------------------------
class Iso:
    __slots__ = ("a", "b", "c", "d", "tx", "ty")

    def __init__(self, a=1.0, b=0.0, c=0.0, d=1.0, tx=0.0, ty=0.0):
        self.a, self.b, self.c, self.d, self.tx, self.ty = a, b, c, d, tx, ty

    def __call__(self, p):
        x, y = p
        return (self.a * x + self.b * y + self.tx, self.c * x + self.d * y + self.ty)

    def __matmul__(self, o: "Iso") -> "Iso":
        return Iso(
            self.a * o.a + self.b * o.c,
            self.a * o.b + self.b * o.d,
            self.c * o.a + self.d * o.c,
            self.c * o.b + self.d * o.d,
            self.a * o.tx + self.b * o.ty + self.tx,
            self.c * o.tx + self.d * o.ty + self.ty,
        )

    def det(self) -> float:
        return self.a * self.d - self.b * self.c

    def close(self, o: "Iso", eps=1e-6) -> bool:
        return all(abs(x - y) < eps for x, y in zip(self.tup(), o.tup()))

    def tup(self):
        return (self.a, self.b, self.c, self.d, self.tx, self.ty)


def reflect(p, q) -> Iso:
    """Reflection across the line through p and q."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    a, b, d = 2 * ux * ux - 1, 2 * ux * uy, 2 * uy * uy - 1
    return Iso(a, b, b, d, p[0] - (a * p[0] + b * p[1]), p[1] - (b * p[0] + d * p[1]))


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def mul(p, s):
    return (p[0] * s, p[1] * s)


def cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def unit(u):
    n = math.hypot(*u)
    return (u[0] / n, u[1] / n)


def dist(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])


def line_hit(p1, d1, p2, d2):
    t = cross(sub(p2, p1), d2) / cross(d1, d2)
    return add(p1, mul(d1, t))


# --------------------------------------------------------------------------
# Flat-fold sheet
# --------------------------------------------------------------------------
class Face:
    __slots__ = ("poly", "T", "src", "tag", "hist")

    def __init__(self, poly, T, src, tag, hist):
        self.poly, self.T, self.src, self.tag, self.hist = poly, T, src, tag, hist


class Sheet:
    def __init__(self):
        self.V: list[tuple[float, float]] = []
        self.faces: dict[int, Face] = {}
        self.order: list[int] = []  # back -> front
        self.nid = 0
        self.phases: list[str] = []

    def vid(self, p) -> int:
        for i, q in enumerate(self.V):
            if abs(p[0] - q[0]) < VEPS and abs(p[1] - q[1]) < VEPS:
                return i
        self.V.append((float(p[0]), float(p[1])))
        return len(self.V) - 1

    def add_face(self, pts, T, src, tag=None, hist=None) -> int:
        fid = self.nid
        self.nid += 1
        self.faces[fid] = Face([self.vid(p) for p in pts], T, src, tag or src, list(hist or []))
        return fid

    def centroid(self, fid):
        pts = [self.V[v] for v in self.faces[fid].poly]
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

    def image(self, fid):
        f = self.faces[fid]
        return [f.T(self.V[v]) for v in f.poly]

    def fix_tjunctions(self):
        """Insert every vertex lying on a face edge into that face's ring."""
        for f in self.faces.values():
            ring = []
            for i, a in enumerate(f.poly):
                b = f.poly[(i + 1) % len(f.poly)]
                ring.append(a)
                pa, pb = self.V[a], self.V[b]
                seg = sub(pb, pa)
                L2 = dot(seg, seg)
                hits = []
                for w, pw in enumerate(self.V):
                    if w in (a, b):
                        continue
                    rel = sub(pw, pa)
                    if abs(cross(seg, rel)) / math.sqrt(L2) > VEPS:
                        continue
                    t = dot(rel, seg) / L2
                    if VEPS < t < 1 - VEPS:
                        hits.append((t, w))
                ring.extend(w for _, w in sorted(hits))
            f.poly = ring

    def _split(self, fid, s):
        f = self.faces[fid]
        pos, neg = [], []
        n = len(f.poly)
        for i in range(n):
            a, b = f.poly[i], f.poly[(i + 1) % n]
            sa, sb = s[i], s[(i + 1) % n]
            if sa >= -EPS:
                pos.append(a)
            if sa <= EPS:
                neg.append(a)
            if (sa > EPS and sb < -EPS) or (sa < -EPS and sb > EPS):
                pa, pb = self.V[a], self.V[b]
                w = self.vid(add(pa, mul(sub(pb, pa), sa / (sa - sb))))
                pos.append(w)
                neg.append(w)
        if len(pos) < 3 or len(neg) < 3:
            return None
        stay = self.add_face([self.V[v] for v in neg], f.T, f.src, f.tag, f.hist)
        move = self.add_face([self.V[v] for v in pos], f.T, f.src, f.tag, f.hist)
        i = self.order.index(fid)
        self.order[i : i + 1] = [stay, move]
        del self.faces[fid]
        return stay, move

    def _moving(self, P, Q, select, side_pt) -> list[int]:
        d = unit(sub(Q, P))
        sgn = 1.0 if cross(d, sub(side_pt, P)) > 0 else -1.0
        moving = []
        for fid in list(self.faces):
            if not select(fid, self.faces[fid]):
                continue
            s = [cross(d, sub(p, P)) * sgn for p in self.image(fid)]
            if all(x >= -EPS for x in s):
                if any(x > EPS for x in s):
                    moving.append(fid)
            elif any(x > EPS for x in s):
                r = self._split(fid, s)
                if r:
                    moving.append(r[1])
        self.fix_tjunctions()
        return moving

    def fold(self, label, P, Q, select, side_pt, place) -> list[int]:
        """Simple fold: selected layers on side_pt's side reflect across PQ and
        land in front of (or behind) everything they cover, order reversed."""
        moving = self._moving(P, Q, select, side_pt)
        R = reflect(P, Q)
        for fid in moving:
            self.faces[fid].T = R @ self.faces[fid].T
        mset = set(moving)
        rest = [f for f in self.order if f not in mset]
        mov = [f for f in self.order if f in mset]
        self.order = rest + mov[::-1] if place == "front" else mov[::-1] + rest
        self.check(label)
        return moving

    def reverse_fold(self, label, P, Q, select, side_pt, is_front, back_flap) -> list[int]:
        """Inside reverse fold: the tip reflects across PQ and tucks between the
        flap's back layers (back_flap) and front layers, each half reversed."""
        moving = self._moving(P, Q, select, side_pt)
        R = reflect(P, Q)
        for fid in moving:
            self.faces[fid].T = R @ self.faces[fid].T
            self.faces[fid].tag = label
        mset = set(moving)
        ftip = [f for f in self.order if f in mset and is_front(f)]
        btip = [f for f in self.order if f in mset and not is_front(f)]
        rest = [f for f in self.order if f not in mset]
        at = max(i for i, f in enumerate(rest) if back_flap(f)) + 1
        self.order = rest[:at] + btip[::-1] + ftip[::-1] + rest[at:]
        self.check(label)
        return moving

    def snapshot(self, name):
        rank = {f: i for i, f in enumerate(self.order)}
        for fid, f in self.faces.items():
            f.hist.append((f.T, rank[fid]))
        self.phases.append(name)

    def edges(self):
        E: dict[tuple[int, int], list[int]] = {}
        for fid, f in self.faces.items():
            for i, a in enumerate(f.poly):
                b = f.poly[(i + 1) % len(f.poly)]
                E.setdefault((min(a, b), max(a, b)), []).append(fid)
        return E

    def check(self, label):
        for (a, b), fs in self.edges().items():
            if len(fs) > 2:
                raise RuntimeError(f"{label}: edge {a}-{b} shared by {len(fs)} faces")
            if len(fs) < 2:
                continue
            f, g = self.faces[fs[0]], self.faces[fs[1]]
            for v in (a, b):
                if dist(f.T(self.V[v]), g.T(self.V[v])) > 1e-6:
                    raise RuntimeError(f"{label}: tear along {a}-{b}")
            if not f.T.close(g.T) and not (reflect(f.T(self.V[a]), f.T(self.V[b])) @ f.T).close(g.T):
                raise RuntimeError(f"{label}: edge {a}-{b} is neither flat nor folded")
        for fid, f in self.faces.items():
            pts = [self.V[v] for v in f.poly]
            for i in range(len(pts)):
                p0, p1, p2 = pts[i], pts[(i + 1) % len(pts)], pts[(i + 2) % len(pts)]
                if cross(sub(p1, p0), sub(p2, p1)) < -1e-9:
                    raise RuntimeError(f"{label}: face {fid} not convex CCW")

    def mv(self):
        """{edge: (faces, [0 | +1 valley | -1 mountain] per snapshot)}."""
        out = {}
        for e, fs in self.edges().items():
            if len(fs) != 2:
                continue
            f, g = self.faces[fs[0]], self.faces[fs[1]]
            row = []
            for (Tf, zf), (Tg, zg) in zip(f.hist, g.hist):
                if Tf.close(Tg):
                    row.append(0)
                else:
                    row.append(1 if (1 if Tf.det() > 0 else -1) * (zg - zf) > 0 else -1)
            out[e] = (fs, row)
        return out

    def flat_foldability_problems(self):
        mv = self.mv()
        boundary = {v for e, fs in self.edges().items() if len(fs) == 1 for v in e}
        inc: dict[int, list] = {}
        for (a, b), (_, row) in mv.items():
            inc.setdefault(a, []).append((b, row))
            inc.setdefault(b, []).append((a, row))
        problems = []
        for v, lst in inc.items():
            if v in boundary:
                continue
            pv = self.V[v]
            for k in range(len(self.phases)):
                folded = sorted(
                    (math.atan2(self.V[w][1] - pv[1], self.V[w][0] - pv[0]), row[k]) for w, row in lst if row[k]
                )
                if not folded:
                    continue
                m = sum(1 for _, s in folded if s < 0)
                if abs(m - (len(folded) - m)) != 2:
                    problems.append(f"{self.phases[k]}: Maekawa fails at {pv}")
                angs = [x for x, _ in folded]
                sectors = [(angs[(i + 1) % len(angs)] - angs[i]) % (2 * math.pi) for i in range(len(angs))]
                if abs(sum(s if i % 2 == 0 else -s for i, s in enumerate(sectors))) > 1e-6:
                    problems.append(f"{self.phases[k]}: Kawasaki fails at {pv}")
        return problems


# --------------------------------------------------------------------------
# The orizuru sequence
# --------------------------------------------------------------------------
C1, C2, C3, C4 = (1.0, 1.0), (1.0, -1.0), (-1.0, -1.0), (-1.0, 1.0)
O = (0.0, 0.0)
R1, R2, R3, R4 = (1.0, 0.0), (0.0, -1.0), (-1.0, 0.0), (0.0, 1.0)
K1, K2 = (K, 0.0), (0.0, K)

# Paper roles: c1 / c3 become the wings (petals), c2 the neck, c4 the tail.
# The c2-c4 diagonal (x + y = 0) is the spine between the front (x + y > 0)
# and back halves of the bird base.


def front_half(sh: Sheet, fid: int) -> bool:
    c = sh.centroid(fid)
    return c[0] + c[1] > 0


def quadrant(sh: Sheet, fid: int) -> str:
    x, y = sh.centroid(fid)
    if x >= 0:
        return "c1" if y >= 0 else "c2"
    return "c4" if y >= 0 else "c3"


def inside(p, pts) -> bool:
    return all(cross(sub(pts[(i + 1) % len(pts)], pts[i]), sub(p, pts[i])) >= -1e-9 for i in range(len(pts)))


def build(params=PARAMS):
    sh = Sheet()
    sh.phases.append("flat")
    rx0 = Iso(-1, 0, 0, 1)  # x = 0
    ry0 = Iso(1, 0, 0, -1)  # y = 0
    rd = Iso(0, -1, -1, 0)  # y = -x
    # Preliminary base, built from its CP: midlines mountain, c2/c4 diagonals
    # valley, c1 quadrant in front (top side out), c3 quadrant behind.
    flat = [(Iso(), 0)]
    fA = sh.add_face([O, R1, C1, R4], Iso(), "A", hist=flat)
    fB1 = sh.add_face([O, C2, R1], ry0, "B1", hist=flat)
    fB2 = sh.add_face([O, R2, C2], ry0 @ rd, "B2", hist=flat)
    fC = sh.add_face([O, R3, C3, R2], rd, "C", hist=flat)
    fD1 = sh.add_face([O, C4, R3], rx0 @ rd, "D1", hist=flat)
    fD2 = sh.add_face([O, R4, C4], rx0, "D2", hist=flat)
    sh.order = [fC, fB2, fD1, fB1, fD2, fA]
    sh.check("prelim")
    sh.snapshot("prelim")

    def img(p, pred):
        for fid, f in sh.faces.items():
            if pred(fid) and inside(p, [sh.V[v] for v in f.poly]):
                return f.T(p)
        raise KeyError(p)

    src = lambda fid: sh.faces[fid].src
    leg_tip = img(C1, lambda f: src(f) == "A")  # all corners meet here
    kf, kpf = img(K1, lambda f: src(f) == "A"), img(K2, lambda f: src(f) == "A")
    rf, lf = img(R1, lambda f: src(f) == "A"), img(R4, lambda f: src(f) == "A")

    def petal_fold(name, top, leg_a, leg_b, place):
        ka = sh.fold(name, leg_tip, kf, lambda f, F: F.src in (top, leg_a), rf, place)
        kb = sh.fold(name, leg_tip, kpf, lambda f, F: F.src in (top, leg_b), lf, place)
        kites = set(ka) | set(kb)
        lift = sh.fold(name, kf, kpf, lambda f, F: F.src == top, leg_tip, place)
        top_kites = [f for f in lift if f in kites]
        petal = [f for f in lift if f not in kites]
        leg_kites = [f for f in kites if f not in set(lift)]
        # The petal fold is a spherical 4-bar at each K point (all sectors
        # 67.5 deg); traced in 3D, the kite flaps end up as the outer skin and
        # the lifted petal tucks under them (this is what keeps Maekawa).
        rest = [f for f in sh.order if f not in kites and f not in set(petal)]
        if place == "front":
            sh.order = rest + petal + leg_kites + top_kites
        else:
            sh.order = top_kites + leg_kites + petal + rest
        sh.check(name)
        sh.snapshot(name)

    petal_fold("petal-front", "A", "B1", "D2", "front")
    petal_fold("petal-back", "C", "B2", "D1", "back")

    P = img(O, lambda f: src(f) == "A")  # paper centre (top of the body)
    up = unit(sub(P, leg_tip))
    mid = add(kf, mul(sub(kpf, kf), 0.5))
    e2, e4 = unit(sub(kf, mid)), unit(sub(kpf, mid))
    petal_tip = img(C1, lambda f: src(f) == "A" and sum(sh.centroid(f)) > K)

    def bisector(edge_pt):
        return unit(add(unit(sub(edge_pt, leg_tip)), unit(sub(P, leg_tip))))

    n2, n4 = bisector(kf), bisector(kpf)
    side2 = add(leg_tip, mul(sub(kf, leg_tip), 0.5))
    side4 = add(leg_tip, mul(sub(kpf, leg_tip), 0.5))
    is_front = lambda f, F: front_half(sh, f)
    is_back = lambda f, F: not front_half(sh, f)
    sh.fold("narrow-front", leg_tip, add(leg_tip, n2), is_front, side2, "front")
    sh.fold("narrow-front", leg_tip, add(leg_tip, n4), is_front, side4, "front")
    sh.snapshot("narrow-front")
    sh.fold("narrow-back", leg_tip, add(leg_tip, n2), is_back, side2, "back")
    sh.fold("narrow-back", leg_tip, add(leg_tip, n4), is_back, side4, "back")
    sh.snapshot("narrow-back")
    q2 = line_hit(leg_tip, n2, kf, unit(sub(petal_tip, kf)))
    q4 = line_hit(leg_tip, n4, kpf, unit(sub(petal_tip, kpf)))

    spine_pts = {}

    def leg_reverse(name, quad, s_dist, beta_deg, e_out):
        S = add(leg_tip, mul(up, s_dist))
        b = math.radians(beta_deg)
        d_new = unit(add(mul(e_out, math.cos(b)), mul(up, math.sin(b))))
        line = unit(add(mul(up, -1), d_new))
        sh.reverse_fold(
            name, S, add(S, line),
            lambda f, F: quadrant(sh, f) == quad,
            leg_tip,
            lambda f: front_half(sh, f),
            lambda f: not front_half(sh, f),
        )
        sh.snapshot(name)
        spine_pts[name] = S

    leg_reverse("reverse-neck", "c2", params["neck_s"], params["neck_beta"], e2)
    leg_reverse("reverse-tail", "c4", params["tail_s"], params["tail_beta"], e4)

    neck_tip = img(C2, lambda f: sh.faces[f].tag == "reverse-neck")
    S = spine_pts["reverse-neck"]
    neck_dir = unit(sub(neck_tip, S))
    Sh = add(neck_tip, mul(neck_dir, -params["head_len"]))
    bh = math.radians(params["head_beta"])
    d_head = unit(add(mul(e2, math.cos(bh)), mul(up, math.sin(bh))))
    sh.reverse_fold(
        "reverse-head", Sh, add(Sh, unit(add(neck_dir, d_head))),
        lambda f, F: F.tag == "reverse-neck",
        neck_tip,
        lambda f: front_half(sh, f),
        lambda f: sh.faces[f].tag == "reverse-neck" and not front_half(sh, f),
    )
    sh.snapshot("reverse-head")
    wing = lambda top, s: (lambda f, F: F.src == top and s * sum(sh.centroid(f)) > K)
    sh.fold("wing-front", q2, q4, wing("A", 1), petal_tip, "front")
    sh.snapshot("wing-front")
    sh.fold("wing-back", q2, q4, wing("C", -1), petal_tip, "back")
    sh.snapshot("wing-back")
    return sh


# --------------------------------------------------------------------------
# Animation: rigid crease-angle tracks
# --------------------------------------------------------------------------
FORMS = ["flat", "prelim", "bird", "crane-flat", "crane"]
FORM_PHASE = ["flat", "prelim", "petal-back", "reverse-tail", "wing-back"]

# (animation phase, k0, k1, flat-fold phases it realises). Neck and tail
# inside-reverse together; the head reverses on the raised neck in tap 4.
TAPS = [
    {"form": 1, "phases": [("prelim", 0.0, 1.0, ["prelim"])]},
    {"form": 2, "phases": [("petal-front", 0.0, 0.56, ["petal-front"]), ("petal-back", 0.44, 1.0, ["petal-back"])]},
    {
        "form": 3,
        "phases": [
            ("narrow-front", 0.0, 0.2, ["narrow-front"]),
            ("narrow-back", 0.12, 0.32, ["narrow-back"]),
            ("reverse", 0.34, 1.0, ["reverse-neck", "reverse-tail"]),
        ],
    },
    {"form": 4, "phases": [("head", 0.0, 0.5, ["reverse-head"]), ("wings", 0.42, 1.0, ["wing-front", "wing-back"])]},
]
SAMPLES = 24  # intervals per solved (non-linear) track


def on_line(p, q, f) -> bool:
    return abs(f(p)) < 1e-9 and abs(f(q)) < 1e-9


def rot(ux, uy, th):
    c, s = math.cos(th), math.sin(th)
    C = 1 - c
    return [
        [c + ux * ux * C, ux * uy * C, uy * s],
        [uy * ux * C, c + uy * uy * C, -ux * s],
        [-uy * s, ux * s, c],
    ]


def matmul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


class Closure:
    """Belcastro-Hull vertex closure: around every interior vertex the product
    of rotations about its creases (CCW, valley > 0) must be the identity."""

    def __init__(self, sh: Sheet, crease_of: dict):
        boundary = {v for e, fs in sh.edges().items() if len(fs) == 1 for v in e}
        self.verts = []
        inc: dict[int, list] = {}
        for (a, b), fs in sh.edges().items():
            if len(fs) != 2:
                continue
            c = crease_of.get((a, b), -1)
            inc.setdefault(a, []).append((b, c))
            inc.setdefault(b, []).append((a, c))
        for v, lst in inc.items():
            if v in boundary:
                continue
            pv = sh.V[v]
            ring = []
            for w, c in lst:
                dx, dy = sh.V[w][0] - pv[0], sh.V[w][1] - pv[1]
                n = math.hypot(dx, dy)
                ring.append((math.atan2(dy, dx), dx / n, dy / n, c))
            ring.sort()
            self.verts.append([(ux, uy, c) for _, ux, uy, c in ring])

    def residual(self, ang):
        out = []
        for ring in self.verts:
            P = [[1.0, 0, 0], [0, 1.0, 0], [0, 0, 1.0]]
            for ux, uy, c in ring:
                P = matmul(P, rot(ux, uy, ang[c] if c >= 0 else 0.0))
            out += [P[i][j] - (1.0 if i == j else 0.0) for i in range(3) for j in range(3)]
        return out


def solve_track(closure, base, driven, unknown, start, end, samples, ease_func=None):
    """Rigid mechanism path: driven creases follow s*(end-start) with optional
    easing; unknown creases are solved for vertex closure at every sample
    (Levenberg-Marquardt)."""
    import numpy as np

    ang = dict(base)
    rows = {c: [start[c]] for c in driven + unknown}
    prev, prev2 = [start[c] for c in unknown], None
    for i in range(1, samples + 1):
        s = i / samples
        # Apply easing function if provided for smoother motion
        s_eased = ease_func(s) if ease_func else s
        for c in driven:
            ang[c] = start[c] + (end[c] - start[c]) * s_eased
        if i == samples:
            x = np.array([end[c] for c in unknown])
        else:
            guess = [p + (e - p) / (samples - i + 1) for p, e in zip(prev, (end[c] for c in unknown))]
            if prev2 is not None:
                # Extrapolate from previous two steps for better initial guess
                guess = [2 * p - q for p, q in zip(prev, prev2)]
            x = np.array(guess, float)
            lam = 1e-6
            for _ in range(200):
                for c, v in zip(unknown, x):
                    ang[c] = v
                r = np.array(closure.residual(ang))
                if r @ r < 1e-26:
                    break
                J = np.zeros((len(r), len(unknown)))
                for j, c in enumerate(unknown):
                    ang[c] = x[j] + 1e-7
                    J[:, j] = (np.array(closure.residual(ang)) - r) / 1e-7
                    ang[c] = x[j]
                A = J.T @ J
                g = J.T @ r
                step = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-12), -g)
                xn = x + step
                for c, v in zip(unknown, xn):
                    ang[c] = v
                rn = np.array(closure.residual(ang))
                if rn @ rn < r @ r:
                    x, lam = xn, max(lam * 0.3, 1e-12)
                else:
                    lam *= 10
        for c, v in zip(unknown, x):
            ang[c] = float(v)
        res = max(abs(v) for v in closure.residual(ang))
        if res > 1e-6:
            raise RuntimeError(f"closure fails at s={s:.3f}: {res:.2e}")
        prev2, prev = prev, [float(v) for v in x]
        for c in driven + unknown:
            rows[c].append(ang[c])
    return rows


def overlap(P, Q) -> bool:
    """Convex polygons share interior area (separating axis test)."""
    for poly in (P, Q):
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            n = (b[1] - a[1], a[0] - b[0])
            pa = [dot(n, p) for p in P]
            qa = [dot(n, q) for q in Q]
            if max(pa) <= min(qa) + 1e-7 or max(qa) <= min(pa) + 1e-7:
                return False
    return True


def layer_heights(sh: Sheet, k: int):
    """Smallest stack heights that respect every overlap in the layer order:
    each face sits one above the highest face it covers (longest chain)."""
    ranked = sorted(sh.faces, key=lambda f: sh.faces[f].hist[k][1])
    img = {}
    for f in ranked:
        pts = [sh.faces[f].hist[k][0](sh.V[v]) for v in sh.faces[f].poly]
        if sum(cross(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))) < 0:
            pts = pts[::-1]
        img[f] = pts
    h = {}
    for i, f in enumerate(ranked):
        h[f] = 1 + max((h[g] for g in ranked[:i] if overlap(img[f], img[g])), default=-1)
    return h


# Inside-reverse folds (neck, tail, head): the animation approximates the
# inside-reverse path by smoothly interpolating the tip stack through a soft-
# constraint path (real paper bends at the reverse vertex). The tip rotates
# about the reverse-fold line, but instead of a simple 180° swing, we sample
# a path that opens the tip progressively while keeping vertex closure at
# intermediate steps. The creases on the stack's back side switch to their
# rest (inside-reverse) mountain/valley labels at the flat end of the phase.
# SWING controls the side of the rotation (-1: toward back, +1: toward front).
SWING = -1.0
REVERSE_EASE = True  # Use eased interpolation for smoother reverse folds


def derive(sh: Sheet):
    mv = sh.mv()
    pidx = {name: i for i, name in enumerate(sh.phases)}
    form_k = [pidx[n] for n in FORM_PHASE]
    edges = sorted((e, fs, row) for e, (fs, row) in mv.items() if any(row))
    crease_of = {e: i for i, (e, _, _) in enumerate(edges)}
    wing_phases = {pidx["wing-front"], pidx["wing-back"]}
    creases = []
    for (a, b), fs, row in edges:
        changed = {i for i in range(1, len(row)) if row[i] != row[i - 1]}
        fold = [row[k] * (WING if f == 4 and changed & wing_phases else 1.0) for f, k in enumerate(form_k)]
        pa, pb = sh.V[a], sh.V[b]
        creases.append(
            {
                "a": a,
                "b": b,
                "faces": fs,
                "row": row,
                "fold": fold,
                "spine": on_line(pa, pb, lambda p: p[0] + p[1]),
                "midline": on_line(pa, pb, lambda p: p[0]) or on_line(pa, pb, lambda p: p[1]),
                "hinge": on_line(pa, pb, lambda p: p[0] + p[1] - K) or on_line(pa, pb, lambda p: p[0] + p[1] + K),
            }
        )
    closure = Closure(sh, crease_of)
    PI = math.pi

    def changed_in(phase_names):
        ks = [pidx[n] for n in phase_names]
        return [i for i, c in enumerate(creases) if any(c["row"][k] != c["row"][k - 1] for k in ks)]

    taps = []
    for tap in TAPS:
        f = tap["form"]
        state = {i: c["fold"][f - 1] * PI for i, c in enumerate(creases)}
        phases = []
        for name, k0, k1, flat_phases in tap["phases"]:
            start = dict(state)
            kend = pidx[flat_phases[-1]]
            moving = changed_in(flat_phases)
            end = dict(start)
            for i in moving:
                end[i] = creases[i]["row"][kend] * PI * (WING if f == 4 else 1.0)
            relabel = []
            if name in ("reverse", "head"):
                k_from = pidx[flat_phases[0]] - 1
                moved = {
                    fid for fid, F in sh.faces.items()
                    if not F.hist[k_from][0].close(F.hist[kend][0])
                }
                rows = {}
                for i in moving:
                    c = creases[i]
                    fa, fb = c["faces"]
                    if (fa in moved) == (fb in moved):
                        # inside the tip stack (the tip spine): turns with it
                        rows[i] = [start[i], start[i]]
                    else:
                        base = fb if fa in moved else fa
                        sigma = 1.0 if sh.faces[base].hist[k_from][0].det() > 0 else -1.0
                        if REVERSE_EASE:
                            # Smoother inside-reverse path: ease through intermediate angles
                            # Use a more gradual ease-in-out curve that better approximates
                            # the progressive opening of a real inside-reverse fold
                            samples = SAMPLES
                            path = []
                            for s in range(samples + 1):
                                t = s / samples
                                # Quintic ease-in-out for smoother acceleration/deceleration
                                ease = t * t * t * (t * (t * 6 - 15) + 10)
                                angle = ease * SWING * sigma * PI
                                path.append(angle)
                            rows[i] = path
                        else:
                            rows[i] = [0.0, SWING * sigma * PI]
                    rest = c["row"][kend] * PI
                    final_angle = rows[i][-1]
                    if abs(abs(final_angle) - PI) > 1e-9 or abs(abs(rest) - PI) > 1e-9:
                        raise RuntimeError(f"{name}: crease {i} does not end flat")
                    if final_angle * rest < 0:
                        relabel.append(i)
            else:
                if name == "prelim":
                    driven = [i for i in moving if creases[i]["midline"]]
                elif name.startswith("petal"):
                    driven = [i for i in moving if creases[i]["hinge"]]
                else:
                    driven = moving
                unknown = [i for i in moving if i not in driven]
                # Use smoothstep easing for narrow folds to reduce jerkiness
                ease = (lambda s: s * s * (3 - 2 * s)) if name.startswith("narrow") else None
                rows = solve_track(closure, start, driven, unknown, start, end, SAMPLES if unknown else 2, ease)
            for i in moving:
                state[i] = rows[i][-1]
            phases.append({"name": name, "k0": k0, "k1": k1, "rows": rows, "stack": kend, "relabel": relabel})
        for i, c in enumerate(creases):
            rest = c["fold"][f] * PI
            same = abs(state[i] - rest) < 1e-9 or (abs(abs(rest) - PI) < 1e-9 and abs(abs(state[i]) - PI) < 1e-9)
            if not same:
                raise RuntimeError(f"tap {f}: crease {i} ends at {state[i]} not its rest angle")
        taps.append({"form": f, "phases": phases})

    # Spreading the wings re-layers nothing (they leave the body plane), so the
    # spread crane keeps the crane-flat stack; the flat-folded-wings snapshot
    # only feeds the wing creases' mountain/valley sense.
    for t in taps:
        for ph in t["phases"]:
            if ph["name"] == "wings":
                ph["stack"] = pidx["reverse-head"]
    form_k = form_k[:4] + [pidx["reverse-head"]]
    # paper-thickness stacks at every animation-phase end (and the flat sheet)
    stack_k = sorted({0, *form_k, *(ph["stack"] for t in taps for ph in t["phases"])})
    stacks = []
    for k in stack_k:
        stacks.append(
            {
                "name": sh.phases[k],
                "order": sorted(sh.faces, key=lambda fid: sh.faces[fid].hist[k][1]),
                "height": layer_heights(sh, k) if k else {fid: 0 for fid in sh.faces},
                "flipped": {fid: 1 if sh.faces[fid].hist[k][0].det() < 0 else 0 for fid in sh.faces},
            }
        )
    sidx = {k: i for i, k in enumerate(stack_k)}
    for t in taps:
        for ph in t["phases"]:
            ph["stack"] = sidx[ph["stack"]]
    return creases, taps, [sidx[k] for k in form_k], stacks


def fmt(x: float, digits=12) -> str:
    s = f"{x:.{digits}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def emit(sh: Sheet) -> str:
    creases, taps, form_stack, stacks = derive(sh)
    fids = sorted(sh.faces)
    findex = {fid: i for i, fid in enumerate(fids)}
    root = next(i for i, fid in enumerate(fids) if inside((0.15, 0.15), [sh.V[v] for v in sh.faces[fid].poly]))
    out = [
        "// Generated by scripts/gen-orizuru-cp.py — do not edit by hand.",
        "// Orizuru crease pattern on the paper square [-1, 1]² (top side = +z).",
        "// c1 (1,1) / c3 (-1,-1) become the wings, c2 (1,-1) the neck, c4 (-1,1) the tail.",
        "",
        f"export const CP_FORMS = [{', '.join(repr(n) for n in FORMS)}] as const",
        "",
        "/** Paper-space vertices of the crease pattern. */",
        "export const CP_VERTICES: readonly (readonly [number, number])[] = [",
    ]
    out += [f"  [{fmt(p[0])}, {fmt(p[1])}]," for p in sh.V]
    out += ["]", "", "/** Convex faces as counter-clockwise vertex rings (collinear vertices kept). */"]
    out += ["export const CP_FACES: readonly (readonly number[])[] = ["]
    out += [f"  [{', '.join(str(v) for v in sh.faces[fid].poly)}]," for fid in fids]
    out += [
        "]",
        "",
        "/**",
        " * Crease segments: `fold[f]` is the rest angle after form f as a signed",
        " * fraction of π (valley > 0, mountain < 0, 0 = unfolded); `faces` are the",
        " * two CP faces it hinges.",
        " */",
        "export const CP_CREASES: readonly {",
        "  readonly a: number",
        "  readonly b: number",
        "  readonly faces: readonly [number, number]",
        "  readonly fold: readonly [number, number, number, number, number]",
        "}[] = [",
    ]
    for c in creases:
        fa, fb = (findex[x] for x in c["faces"])
        out.append(f"  {{ a: {c['a']}, b: {c['b']}, faces: [{fa}, {fb}], fold: [{', '.join(fmt(x) for x in c['fold'])}] }},")
    out += [
        "]",
        "",
        "/** Face held still while folding (the body's top triangle at the paper centre). */",
        f"export const CP_ROOT_FACE = {root}",
        "",
        "/**",
        " * Flat-fold layer stacks (paper thickness), one per animation-phase end:",
        " * `order` is back → front; `height` the smallest per-face stack heights that",
        " * keep every overlapping pair in that order; `flipped` marks faces whose top",
        " * side faces the back of the stack.",
        " */",
        "export const CP_STACKS: readonly {",
        "  readonly name: string",
        "  readonly order: readonly number[]",
        "  readonly height: readonly number[]",
        "  readonly flipped: readonly number[]",
        "}[] = [",
    ]
    for st in stacks:
        out.append("  {")
        out.append(f"    name: '{st['name']}',")
        out.append(f"    order: [{', '.join(str(findex[f]) for f in st['order'])}],")
        out.append(f"    height: [{', '.join(str(st['height'][f]) for f in fids)}],")
        out.append(f"    flipped: [{', '.join(str(st['flipped'][f]) for f in fids)}],")
        out.append("  },")
    out += [
        "]",
        "",
        "/** Stack (index into CP_STACKS) at rest for each form. */",
        f"export const CP_FORM_STACK = [{', '.join(str(i) for i in form_stack)}] as const",
        "",
        "/**",
        " * Per tap (ending at `form`): phases over tap progress k ∈ [k0, k1]. Each",
        " * phase moves `creases`; `angles[i]` samples crease i's angle (fraction of",
        " * π) at evenly spaced phase progress 0..1. Every track is rigid: solved",
        " * tracks keep each interior vertex closed, two-sample tracks are single",
        " * rotations. Reverse phases turn the tip stack on the simple-fold branch;",
        " * `relabel` lists creases that take their rest (inside-reverse) sign at",
        " * the flat end of the phase — same pose, other mountain/valley label.",
        " */",
        "export const FOLD_TAPS: readonly {",
        "  readonly form: number",
        "  readonly phases: readonly {",
        "    readonly id: string",
        "    readonly k0: number",
        "    readonly k1: number",
        "    /** Stack (index into CP_STACKS) reached at the end of the phase. */",
        "    readonly stack: number",
        "    readonly relabel: readonly number[]",
        "    readonly creases: readonly number[]",
        "    readonly angles: readonly (readonly number[])[]",
        "  }[]",
        "}[] = [",
    ]
    for tap in taps:
        out.append("  {")
        out.append(f"    form: {tap['form']},")
        out.append("    phases: [")
        for ph in tap["phases"]:
            ids = sorted(ph["rows"])
            out.append("      {")
            out.append(f"        id: '{ph['name']}',")
            out.append(f"        k0: {fmt(ph['k0'])},")
            out.append(f"        k1: {fmt(ph['k1'])},")
            out.append(f"        stack: {ph['stack']},")
            out.append(f"        relabel: [{', '.join(str(i) for i in ph['relabel'])}],")
            out.append(f"        creases: [{', '.join(str(i) for i in ids)}],")
            out.append("        angles: [")
            for i in ids:
                out.append(f"          [{', '.join(fmt(v / math.pi, 5) for v in ph['rows'][i])}],")
            out.append("        ],")
            out.append("      },")
        out.append("    ],")
        out.append("  },")
    out += ["]", ""]
    return "\n".join(out)


def main():
    sh = build()
    problems = sh.flat_foldability_problems()
    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit(1)
    text = emit(sh)
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print(f"{OUT.relative_to(ROOT)} is stale; run scripts/gen-orizuru-cp.py", file=sys.stderr)
            sys.exit(1)
        print("orizuru CP data up to date")
        return
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(sh.V)} vertices, {len(sh.faces)} faces")


if __name__ == "__main__":
    main()

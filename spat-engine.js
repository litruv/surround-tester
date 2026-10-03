/**
 * spat-engine.js — discrete surround spat (VBAP / FOA / occlusion).
 * No Three.js, no DOM. The demo app drives this via SurroundEngine.
 */

/** @typedef {{ id: string, ch: number, angle: number, isLfe?: boolean }} Speaker */

/** @type {SurroundEngine | null} */
let _eng = null;

function _S() {
  return _eng.settings;
}
function _L() {
  return _eng.listener;
}
function _O() {
  return _eng.occluders;
}

const LAYOUTS = {
  stereo: {
    label: "Stereo",
    channels: 2,
    speakers: [
      { id: "FL", ch: 0, angle: -Math.PI / 6 },
      { id: "FR", ch: 1, angle: Math.PI / 6 },
    ],
  },
  quad: {
    label: "Quad",
    channels: 4,
    speakers: [
      { id: "FL", ch: 0, angle: -Math.PI / 4 },
      { id: "FR", ch: 1, angle: Math.PI / 4 },
      { id: "BR", ch: 3, angle: (3 * Math.PI) / 4 },
      { id: "BL", ch: 2, angle: (-3 * Math.PI) / 4 },
    ],
  },
  "51": {
    label: "5.1",
    channels: 6,
    speakers: [
      { id: "FL", ch: 0, angle: -Math.PI / 6 },
      { id: "FR", ch: 1, angle: Math.PI / 6 },
      { id: "FC", ch: 2, angle: 0 },
      { id: "LFE", ch: 3, angle: 0, isLfe: true },
      { id: "SL", ch: 4, angle: (-110 * Math.PI) / 180 },
      { id: "SR", ch: 5, angle: (110 * Math.PI) / 180 },
    ],
  },
  "71": {
    label: "7.1",
    channels: 8,
    speakers: [
      { id: "FL", ch: 0, angle: -Math.PI / 6 },
      { id: "FR", ch: 1, angle: Math.PI / 6 },
      { id: "FC", ch: 2, angle: 0 },
      { id: "LFE", ch: 3, angle: 0, isLfe: true },
      { id: "BL", ch: 4, angle: (-150 * Math.PI) / 180 },
      { id: "BR", ch: 5, angle: (150 * Math.PI) / 180 },
      { id: "SL", ch: 6, angle: -Math.PI / 2 },
      { id: "SR", ch: 7, angle: Math.PI / 2 },
    ],
  },
};

/** Ear height (m). Sources use their own y for 3D distance / floor occlusion. */
const LISTENER_EAR_Y = 1.55;

function listenerEarY() {
  return _eng?.listener?.y ?? LISTENER_EAR_Y;
}

/** Deck between ground and upstairs walkers (m). */
function floorDeckY() {
  return _S().floorHeightM;
}

function floorThicknessM() {
  return 0.22;
}

// --- math / spatializers ---------------------------------------------------

function normalizeAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function shortestAngleDelta(from, to) {
  return normalizeAngle(to - from);
}

/** Yaw that aims the nose (local −Z) along world delta (dx, dz). */
function yawFromDir(dx, dz) {
  // Ry maps local −Z → (−sin y, −cos y); match that to (dx, dz)
  return Math.atan2(-dx, -dz);
}

function dirVec(theta) {
  return { x: Math.sin(theta), y: Math.cos(theta) };
}

function angleToXZ(angle, radius) {
  return { x: Math.sin(angle) * radius, z: -Math.cos(angle) * radius };
}

function pointInRect(px, pz, r) {
  return px >= r.x0 && px <= r.x1 && pz >= r.z0 && pz <= r.z1;
}

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const det = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(det) < 1e-9) return false;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / det;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function xzToAngle(x, z) {
  // 0 = listener front, + = right — respects current yaw
  const d = toListenerBasis(x, z);
  return Math.atan2(d.x, d.y);
}

function distance2(x, z) {
  return Math.hypot(x - _L().x, z - _L().z);
}

/** 3D distance from listener ears to a world point. */
function distance3(x, y, z) {
  return Math.hypot(x - _L().x, (y ?? 0) - listenerEarY(), z - _L().z);
}

function combineOcclusion(a, b) {
  return 1 - (1 - Math.max(0, Math.min(1, a))) * (1 - Math.max(0, Math.min(1, b)));
}

/**
 * Floor-slab occlusion when source and ears are on opposite sides of the deck.
 * Grazing paths travel farther through the slab → more absorption.
 */
function computeFloorOcclusion(x, y, z) {
  if (!_S().occlusion || !_S().floorOcc) return 0;
  const ly = listenerEarY();
  const fy = floorDeckY();
  const srcAbove = (y ?? 0) >= fy;
  const lisAbove = ly >= fy;
  if (srcAbove === lisAbove) return 0;

  const horiz = Math.hypot(x - _L().x, z - _L().z);
  const dy = Math.abs((y ?? 0) - ly);
  const slant = Math.hypot(horiz, dy) / Math.max(0.08, dy);
  const pathThrough = floorThicknessM() * slant;
  const deep = smoothstep(0.1, 1.15, pathThrough);
  // Floors are absorbent — stronger baseline than a thin wall
  return Math.min(0.95, 0.38 + 0.52 * deep);
}

/** Elevation −1..+1 (below → above), from ears to source. */
function elevationFactor(x, y, z) {
  const horiz = Math.hypot(x - _L().x, z - _L().z);
  const dy = (y ?? 0) - listenerEarY();
  return Math.atan2(dy, Math.max(0.2, horiz)) / (Math.PI / 2);
}

/** Unit vector in listener-local basis: x = right, y = front (nose). */
function toListenerBasis(worldX, worldZ) {
  const dx = worldX - _L().x;
  const dz = worldZ - _L().z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / len;
  const uz = dz / len;
  // Match Three.js Ry(yaw): local −Z → (−sin, −cos), local +X → (cos, −sin)
  const fwdX = -Math.sin(_L().yaw);
  const fwdZ = -Math.cos(_L().yaw);
  const rightX = Math.cos(_L().yaw);
  const rightZ = -Math.sin(_L().yaw);
  return {
    x: ux * rightX + uz * rightZ,
    y: ux * fwdX + uz * fwdZ,
    len,
  };
}

/** Smoothly ease _L().yaw toward targetYaw (rad). */
function smoothListenerYaw(dt, targetYaw, sharpness = 5.5) {
  const d = shortestAngleDelta(_L().yaw, targetYaw);
  const t = 1 - Math.exp(-sharpness * dt);
  _L().yaw = normalizeAngle(_L().yaw + d * t);
}

/**
 * How far behind the listener a point is (0 = front/side, 1 = straight behind).
 * Uses facing −Z (nose direction). Only engages past the left/right line.
 */
function behindAmount(worldX, worldZ) {
  const d = toListenerBasis(worldX, worldZ);
  if (d.len < 0.12) return 0;
  // frontness d.y: +1 front → -1 behind — no cue until actually rear-ish
  return 1 - smoothstep(-0.92, -0.08, d.y);
}

/**
 * Speaker direction in listener-local basis (x = right, y = front).
 * Channels stay locked to the nose — turning remaps world sources across the ring.
 */
function speakerLocalDir(sp) {
  return {
    x: Math.sin(sp.angle),
    y: Math.cos(sp.angle),
    ch: sp.ch,
    ang: sp.angle,
  };
}

/** Room-fixed speaker position for visualization (audio uses speakerLocalDir). */
function speakerWorldPos(sp, radius = 3.4) {
  return angleToXZ(sp.angle, radius);
}

function volCurve(pct) {
  const p = Number(pct) / 100;
  return p * p;
}

/**
 * Speakers used for spatial decode.
 * @param {{ skipCenter?: boolean }} [opts] VBAP skips FC so the front image is a
 *   continuous FL↔FR phantom (1° off-center still mixes both ears/speakers).
 */
function orbitSpeakers(layout, channelCount, opts = {}) {
  const skipCenter = !!opts.skipCenter;
  return layout.speakers
    .filter((s) => {
      if (s.isLfe || s.ch >= channelCount) return false;
      if (skipCenter && s.id === "FC") return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.angle - b.angle);
}

/**
 * Equal-power L/R pan from listener-relative direction.
 * Front/back folded so behind keeps a left/right image instead of hard-snapping.
 */
function stereoPairPan(sx, sz, speakers, out) {
  out.fill(0);
  if (speakers.length < 2) {
    if (speakers[0]) out[speakers[0].ch] = 1;
    return;
  }
  const s = toListenerBasis(sx, sz);
  const a = speakers[0];
  const b = speakers[1];
  // Left = more counter-clockwise from front in our angle convention (− = left)
  const left = a.angle <= b.angle ? a : b;
  const right = left === a ? b : a;
  if (s.len < 0.05) {
    out[left.ch] = Math.SQRT1_2;
    out[right.ch] = Math.SQRT1_2;
    return;
  }
  // Fold behind onto the front L/R stage; pan by lateral direction
  const az = Math.atan2(s.x, Math.abs(s.y)); // −π/2..+π/2
  const t = Math.max(0, Math.min(1, az / Math.PI + 0.5)); // 0 = left, 1 = right
  const ang = t * Math.PI * 0.5;
  out[left.ch] = Math.cos(ang);
  out[right.ch] = Math.sin(ang);
}

/**
 * Pulkki 2D VBAP using world positions relative to the movable listener.
 * Two-speaker layouts use equal-power pan (smooth stereo mix).
 * @param {number} sx
 * @param {number} sz
 */
function vbapGains(sx, sz, speakers, out) {
  out.fill(0);
  if (!speakers.length) return;
  if (speakers.length === 1) {
    out[speakers[0].ch] = 1;
    return;
  }
  if (speakers.length === 2) {
    stereoPairPan(sx, sz, speakers, out);
    return;
  }

  const s = toListenerBasis(sx, sz);
  if (s.len < 0.05) {
    const u = 1 / Math.sqrt(speakers.length);
    for (const sp of speakers) out[sp.ch] = u;
    return;
  }

  // Speakers are head-locked (local angles); sources are world → listener basis
  const dirs = speakers.map((sp) => speakerLocalDir(sp));
  dirs.sort((a, b) => a.ang - b.ang);

  const n = dirs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = dirs[i];
    const b = dirs[j];
    const det = a.x * b.y - b.x * a.y;
    if (Math.abs(det) < 1e-9) continue;
    const g0 = (s.x * b.y - s.y * b.x) / det;
    const g1 = (a.x * s.y - a.y * s.x) / det;
    if (g0 >= -1e-5 && g1 >= -1e-5) {
      const gg0 = Math.max(0, g0);
      const gg1 = Math.max(0, g1);
      const power = Math.sqrt(gg0 * gg0 + gg1 * gg1) || 1;
      out[a.ch] = gg0 / power;
      out[b.ch] = gg1 / power;
      return;
    }
  }
  let nearest = 0;
  let bestD = Infinity;
  const theta = Math.atan2(s.x, s.y);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(normalizeAngle(theta - dirs[i].ang));
    if (d < bestD) {
      bestD = d;
      nearest = i;
    }
  }
  out[dirs[nearest].ch] = 1;
}

/** True when the active ring has a rear-ish speaker (not stereo / truncated 2ch). */
function speakerRingCoversRear(speakers) {
  for (const sp of speakers) {
    if (Math.cos(sp.angle) < -0.15) return true;
  }
  return false;
}

/**
 * Horizontal FOA projection from listener toward source.
 * Front-only rings (stereo / 2ch device) fold the rear half onto the front
 * stage so cardioid lobes don't mute straight behind.
 */
function foaGains(sx, sz, speakers, out, k = Math.SQRT2) {
  out.fill(0);
  if (!speakers.length) return;
  let theta = xzToAngle(sx, sz);
  if (!speakerRingCoversRear(speakers)) {
    // Keep left/right (sin); mirror front/back so |θ| ≤ 90°
    theta = Math.atan2(Math.sin(theta), Math.abs(Math.cos(theta)));
  }
  let power = 0;
  const w = [];
  for (const sp of speakers) {
    // Head-locked speaker angle (not world orbit)
    const g = Math.max(0, 1 + k * Math.cos(theta - sp.angle));
    w.push(g);
    power += g * g;
  }
  // Safety: never leave a silent hole if lobes still collapse
  if (power < 1e-6) {
    const u = 1 / Math.sqrt(speakers.length);
    for (const sp of speakers) out[sp.ch] = u;
    return;
  }
  const norm = Math.sqrt(power) || 1;
  for (let i = 0; i < speakers.length; i++) out[speakers[i].ch] = w[i] / norm;
}

function inverseDistance(r, ref = 1) {
  return ref / Math.max(0.45, r);
}

/** Distance-based air absorption: closer = brighter, farther = duller. */
function airCutoffHz(r) {
  if (!_S().air) return 18000;
  const t = Math.min(1, Math.max(0, (r - 0.5) / 7.5));
  return 14500 - t * 12000; // ~14.5 kHz near → ~2.5 kHz far
}

/**
 * How much to widen toward omnidirectional as the source approaches the listener.
 * 0 = fully directional, 1 = equal-power on all surround speakers.
 */
function nearFieldBlend(r) {
  if (!_S().nearField) return 0;
  const inner = 0.4; // fully filled inside this radius (m)
  const outer = 1.75; // fully directional beyond this
  if (r >= outer) return 0;
  if (r <= inner) return 1;
  const t = (outer - r) / (outer - inner);
  return t * t * (3 - 2 * t);
}

/**
 * Blend directional gains toward constant-power omni across the speaker ring.
 * Keeps total energy stable so near sources get louder via distance, not gain sum.
 */
function applyNearFieldFill(gains, speakers, blend) {
  if (blend <= 1e-4 || speakers.length === 0) return;
  const omni = 1 / Math.sqrt(speakers.length);
  for (const sp of speakers) {
    const d = gains[sp.ch] || 0;
    gains[sp.ch] = d * (1 - blend) + omni * blend;
  }
  let power = 0;
  for (const sp of speakers) power += gains[sp.ch] * gains[sp.ch];
  const norm = Math.sqrt(power) || 1;
  for (const sp of speakers) gains[sp.ch] /= norm;
}




function smoothstep(e0, e1, x) {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Exact path length of segment A→B inside AABB (Liang–Barsky).
 * Sampling used to miss thin walls / grazing angles.
 */
function losInteriorLength(ax, az, bx, bz, o) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return pointInRect(ax, az, o) ? 1e-4 : 0;

  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, ax - o.x0],
    [dx, o.x1 - ax],
    [-dz, az - o.z0],
    [dz, o.z1 - az],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return 0;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return 0;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return 0;
      if (r < t1) t1 = r;
    }
  }
  if (t1 < t0) return 0;
  return (t1 - t0) * len;
}

/** Min distance from segment A→B to the AABB (0 if it clips the box). */
function segmentAabbClearance(ax, az, bx, bz, o) {
  if (losInteriorLength(ax, az, bx, bz, o) > 0) return 0;
  const corners = [
    [o.x0, o.z0],
    [o.x1, o.z0],
    [o.x1, o.z1],
    [o.x0, o.z1],
  ];
  const edges = [
    [o.x0, o.z0, o.x1, o.z0],
    [o.x1, o.z0, o.x1, o.z1],
    [o.x1, o.z1, o.x0, o.z1],
    [o.x0, o.z1, o.x0, o.z0],
  ];
  let best = Infinity;
  // Distance from each endpoint to box + from segment to corners/edges
  for (const [px, pz] of [
    [ax, az],
    [bx, bz],
  ]) {
    const cx = Math.max(o.x0, Math.min(o.x1, px));
    const cz = Math.max(o.z0, Math.min(o.z1, pz));
    best = Math.min(best, Math.hypot(px - cx, pz - cz));
  }
  for (const [cx, cz] of corners) {
    best = Math.min(best, pointToSegmentDistance(cx, cz, ax, az, bx, bz));
  }
  for (const [x0, z0, x1, z1] of edges) {
    best = Math.min(best, segmentSegmentDistance(ax, az, bx, bz, x0, z0, x1, z1));
  }
  return best;
}

function pointToSegmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function segmentSegmentDistance(ax, az, bx, bz, cx, cz, dx, dz) {
  if (segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz)) return 0;
  return Math.min(
    pointToSegmentDistance(ax, az, cx, cz, dx, dz),
    pointToSegmentDistance(bx, bz, cx, cz, dx, dz),
    pointToSegmentDistance(cx, cz, ax, az, bx, bz),
    pointToSegmentDistance(dx, dz, ax, az, bx, bz)
  );
}

/**
 * Angular silhouette of a convex AABB as seen from (lx,lz).
 * Returns the occupied angle span [span0, span1] (span1 may be > π span0+2π).
 */
function aabbAngularSpan(lx, lz, o) {
  const angs = [
    Math.atan2(o.x0 - lx, -(o.z0 - lz)),
    Math.atan2(o.x1 - lx, -(o.z0 - lz)),
    Math.atan2(o.x1 - lx, -(o.z1 - lz)),
    Math.atan2(o.x0 - lx, -(o.z1 - lz)),
  ].sort((a, b) => a - b);

  // Largest empty gap between consecutive corner angles ⇒ complement is the solid span
  let maxGap = -1;
  let gapIdx = 0;
  for (let i = 0; i < 4; i++) {
    const a = angs[i];
    const b = angs[(i + 1) % 4] + (i === 3 ? Math.PI * 2 : 0);
    const gap = b - a;
    if (gap > maxGap) {
      maxGap = gap;
      gapIdx = i;
    }
  }
  const span0 = angs[(gapIdx + 1) % 4];
  let span1 = angs[gapIdx];
  if (span1 <= span0) span1 += Math.PI * 2;
  return { span0, span1, width: span1 - span0 };
}

/** How deep `ang` sits inside the span (0 = on edge / outside, 1 = mid-umbra). */
function spanEdgeDepth(ang, span0, span1) {
  let a = ang;
  while (a < span0) a += Math.PI * 2;
  while (a > span0 + Math.PI * 2) a -= Math.PI * 2;
  if (a < span0 || a > span1) return 0;
  const dist = Math.min(a - span0, span1 - a);
  const half = (span1 - span0) * 0.5;
  if (half < 1e-6) return 1;
  return Math.max(0, Math.min(1, dist / half));
}

/**
 * Continuous occlusion 0..1 (walls × optional floor slab).
 * Scales with path length through the wall — thin slabs muffle, thick ones mute.
 * Corner/grazing softens further (diffraction).
 * @param {number} [y=0]
 */
function computeOcclusion(x, z, y = 0) {
  if (!_S().occlusion) return 0;
  const lx = _L().x;
  const lz = _L().z;
  if (distance3(x, y, z) < 0.08) return 0;

  const srcAng = Math.atan2(x - lx, -(z - lz));
  const softAng = 0.55;
  let blocked = 0;

  for (const o of _O()) {
    if (pointInRect(lx, lz, o)) {
      blocked = Math.max(blocked, 0.7);
      continue;
    }
    if (pointInRect(x, z, o)) {
      blocked = Math.max(blocked, 0.75);
      continue;
    }

    const insideLen = losInteriorLength(lx, lz, x, z, o);
    const span = aabbAngularSpan(lx, lz, o);
    const edgeDist = (() => {
      let a = srcAng;
      while (a < span.span0) a += Math.PI * 2;
      while (a > span.span0 + Math.PI * 2) a -= Math.PI * 2;
      if (a < span.span0 || a > span.span1) {
        return Math.min(
          Math.abs(normalizeAngle(srcAng - span.span0)),
          Math.abs(normalizeAngle(srcAng - span.span1))
        );
      }
      return Math.min(a - span.span0, span.span1 - a);
    })();

    if (insideLen <= 1e-6) {
      // Clear LOS — faint muffling only when skimming past a corner/edge
      const clearance = segmentAabbClearance(lx, lz, x, z, o);
      const graze = 0.35;
      if (clearance < graze) {
        const near = (1 - clearance / graze) * 0.18;
        const cornerBoost = 1 - smoothstep(0.05, softAng, edgeDist);
        blocked = Math.max(blocked, near * (0.5 + 0.5 * cornerBoost));
      }
      continue;
    }

    // Path length through AABB: ~0.2m whisper, ~1.4m near-full block
    const deep = smoothstep(0.08, 1.4, insideLen);
    const intoUmbra = smoothstep(0, softAng, edgeDist);
    // Edge of silhouette leaks more (thin + grazing)
    const cornerRelief = (1 - deep) * (1 - intoUmbra) * 0.4;
    const local = Math.min(0.9, 0.12 + 0.72 * deep + 0.1 * intoUmbra * deep - cornerRelief);
    blocked = Math.max(blocked, Math.max(0, local));
  }

  return combineOcclusion(blocked, computeFloorOcclusion(x, y, z));
}

/**
 * Reflect point P across the infinite line through origin with unit normal (nx, nz).
 */
function reflectPointAcrossLine(px, pz, ox, oz, nx, nz) {
  const dx = px - ox;
  const dz = pz - oz;
  const d = dx * nx + dz * nz;
  return { x: px - 2 * d * nx, z: pz - 2 * d * nz };
}

/**
 * Specular bounce on a finite wall segment (any orientation).
 * Image-source method ⇒ angle of incidence = angle of reflection.
 *
 * Segment from (x0,z0)→(x1,z1); (nx,nz) is the outward/reflecting unit normal.
 *
 * @returns {{ x:number, z:number, bx:number, bz:number, rfl:number, tag:string, dist:number, delay:number } | null}
 */
function trySegmentReflection(sx, sz, seg, rfl, tag) {
  const lx = _L().x;
  const lz = _L().z;
  const { x0, z0, x1, z1, nx, nz, solid } = seg;
  const eps = 0.05;

  // Both must be on the reflecting side of the infinite line
  const sSide = (sx - x0) * nx + (sz - z0) * nz;
  const lSide = (lx - x0) * nx + (lz - z0) * nz;
  if (sSide < -eps || lSide < -eps) return null;

  if (solid && (pointInRect(sx, sz, solid) || pointInRect(lx, lz, solid))) return null;

  const img = reflectPointAcrossLine(sx, sz, x0, z0, nx, nz);
  const ix = img.x;
  const iz = img.z;

  // Bounce = intersection of listener → image with the wall line
  // (L + t(I−L) − O) · n = 0  ⇒  t = −((L−O)·n) / ((I−L)·n)
  const rdx = ix - lx;
  const rdz = iz - lz;
  const denom = rdx * nx + rdz * nz;
  if (Math.abs(denom) < 1e-8) return null;
  const t = -lSide / denom;
  if (t <= 0.01 || t >= 0.99) return null;

  const bx = lx + t * rdx;
  const bz = lz + t * rdz;

  // Must land on the finite segment (allow near corners — only reject true ends)
  const segDx = x1 - x0;
  const segDz = z1 - z0;
  const segLen2 = segDx * segDx + segDz * segDz;
  if (segLen2 < 1e-6) return null;
  const u = ((bx - x0) * segDx + (bz - z0) * segDz) / segLen2;
  if (u < 0.005 || u > 0.995) return null;
  // Keep bounce glued to the segment (kill float drift off the line)
  const qx = x0 + u * segDx;
  const qz = z0 + u * segDz;

  // Path legs must stay on the reflecting side of this face
  const midS = ((sx + qx) * 0.5 - x0) * nx + ((sz + qz) * 0.5 - z0) * nz;
  const midL = ((lx + qx) * 0.5 - x0) * nx + ((lz + qz) * 0.5 - z0) * nz;
  if (midS < -eps || midL < -eps) return null;

  // Test paths from a point nudged off the face so corner skims don't
  // punch through the reflecting AABB padding and kill the bounce.
  const lift = 0.1;
  const tx = qx + nx * lift;
  const tz = qz + nz * lift;

  // Only reject if the path tunnels *deep* through the reflecting slab
  if (solid) {
    if (segmentDeepInterior(sx, sz, tx, tz, solid) || segmentDeepInterior(tx, tz, lx, lz, solid)) {
      return null;
    }
  }

  // Soft-occlude bounce legs against *other* walls (not the reflector)
  const pathOcc = Math.max(
    segmentPathOcclusion(sx, sz, tx, tz, solid),
    segmentPathOcclusion(tx, tz, lx, lz, solid)
  );
  if (pathOcc > 0.92) return null;

  const srcBounce = Math.hypot(sx - qx, sz - qz);
  const lisBounce = Math.hypot(qx - lx, qz - lz);
  const path = srcBounce + lisBounce;
  if (path < 0.2 || path > 28) return null;

  // Arrival direction for spat = bounce → listener, encoded as image source
  return {
    x: ix,
    z: iz,
    bx: qx,
    bz: qz,
    rfl: rfl * (1 - 0.85 * pathOcc),
    pathOcc,
    tag,
    dist: path,
    srcBounce,
    lisBounce,
    delay: path / 343,
  };
}

/** Deep interior hit only (ignores surface / corner padding band). */
function segmentDeepInterior(ax, az, bx, bz, o) {
  const margin = 0.1;
  const samples = 14;
  let hits = 0;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (
      x > o.x0 + margin &&
      x < o.x1 - margin &&
      z > o.z0 + margin &&
      z < o.z1 - margin
    ) {
      hits++;
    }
  }
  // Need a sustained tunnel, not one sample clipping a corner
  return hits >= 3;
}

/** True if open segment (a→b) crosses the interior of AABB (not just grazing a face). */
function segmentHitsSolidInterior(ax, az, bx, bz, o) {
  const samples = 12;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (
      x > o.x0 + 0.02 &&
      x < o.x1 - 0.02 &&
      z > o.z0 + 0.02 &&
      z < o.z1 - 0.02
    ) {
      return true;
    }
  }
  return false;
}

/**
 * How much a path segment is blocked by *other* occluder walls (0..1).
 * Reflector is skipped. Ignores endpoint touches and light corner grazes.
 * @param {object | null | undefined} skip Solid to ignore (the reflecting wall).
 */
function segmentPathOcclusion(ax, az, bx, bz, skip = null) {
  let blocked = 0;

  for (const o of _O()) {
    if (o === skip) continue;

    // Strict interior length (exclude surface shell so face endpoints don't count)
    const insideLen = losStrictInteriorLength(ax, az, bx, bz, o, 0.06);
    if (insideLen > 0.08) {
      blocked = Math.max(blocked, 0.4 + 0.6 * smoothstep(0.08, 0.55, insideLen));
      continue;
    }

    // Edge clip — ignore intersections near segment ends (bounce-point false hits)
    const edges = [
      [o.x0, o.z0, o.x1, o.z0],
      [o.x1, o.z0, o.x1, o.z1],
      [o.x1, o.z1, o.x0, o.z1],
      [o.x0, o.z1, o.x0, o.z0],
    ];
    for (const [x0, z0, x1, z1] of edges) {
      const hit = segmentIntersectionPoint(ax, az, bx, bz, x0, z0, x1, z1);
      if (!hit) continue;
      const fromA = Math.hypot(hit.x - ax, hit.z - az);
      const fromB = Math.hypot(hit.x - bx, hit.z - bz);
      if (fromA < 0.15 || fromB < 0.15) continue; // endpoint / bounce touch
      // Light graze near a corner of the blocker — softer than a full block
      const cornerDist = distToRectCorners(hit.x, hit.z, o);
      if (cornerDist < 0.35) {
        blocked = Math.max(blocked, 0.25 + 0.35 * (1 - cornerDist / 0.35));
      } else {
        blocked = Math.max(blocked, 0.72);
      }
      break;
    }
  }
  return blocked;
}

/** Interior path length using a shrunk AABB (ignores surface padding). */
function losStrictInteriorLength(ax, az, bx, bz, o, margin) {
  const n = 28;
  let inside = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (
      x > o.x0 + margin &&
      x < o.x1 - margin &&
      z > o.z0 + margin &&
      z < o.z1 - margin
    ) {
      inside++;
    }
  }
  if (inside === 0) return 0;
  return (inside / (n + 1)) * Math.hypot(bx - ax, bz - az);
}

function segmentIntersectionPoint(ax, az, bx, bz, cx, cz, dx, dz) {
  const det = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(det) < 1e-9) return null;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / det;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / det;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + t * (bx - ax), z: az + t * (bz - az) };
}

function distToRectCorners(px, pz, o) {
  const corners = [
    [o.x0, o.z0],
    [o.x1, o.z0],
    [o.x1, o.z1],
    [o.x0, o.z1],
  ];
  let best = Infinity;
  for (const [cx, cz] of corners) {
    best = Math.min(best, Math.hypot(px - cx, pz - cz));
  }
  return best;
}

/** Exterior reflecting segments for an AABB occluder (skip stubby end-caps). */
function occluderReflectSegments(o, minLen = 0.55) {
  /** @type {{ x0:number,z0:number,x1:number,z1:number,nx:number,nz:number,solid:typeof o }[]} */
  const segs = [
    { x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z0, nx: 0, nz: -1, solid: o },
    { x0: o.x0, z0: o.z1, x1: o.x1, z1: o.z1, nx: 0, nz: 1, solid: o },
    { x0: o.x0, z0: o.z0, x1: o.x0, z1: o.z1, nx: -1, nz: 0, solid: o },
    { x0: o.x1, z0: o.z0, x1: o.x1, z1: o.z1, nx: 1, nz: 0, solid: o },
  ];
  return segs.filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) >= minLen);
}

/**
 * First-order specular image sources off draggable occluder walls only.
 * Room shell stays on the Sabine / early room bus — not as bounce lines.
 */
function computeImageSources(sx, sz) {
  const out = [];
  const wallR = 0.62;
  const direct = distance2(sx, sz);

  for (let i = 0; i < _O().length; i++) {
    const segs = occluderReflectSegments(_O()[i]);
    for (let j = 0; j < segs.length; j++) {
      const hit = trySegmentReflection(sx, sz, segs[j], wallR, `wall${i}-${j}`);
      if (!hit) continue;
      hit.deltaDist = hit.dist - direct;
      hit.deltaDelay = hit.deltaDist / 343;
      out.push(hit);
    }
  }

  // Prefer shorter paths; skip near-duplicate arrival angles
  out.sort((a, b) => a.dist - b.dist);
  const picked = [];
  const usedAngles = [];
  for (const img of out) {
    // No delay-based mute — audio taps are instantaneous; short paths should be loud
    if (img.dist < 0.25 || img.dist > 24) continue;
    const ang = xzToAngle(img.x, img.z);
    const tooClose = usedAngles.some((a) => Math.abs(normalizeAngle(a - ang)) < 0.18);
    if (tooClose && picked.length >= 2) continue;
    usedAngles.push(ang);
    picked.push(img);
    if (picked.length >= 8) break;
  }
  return picked;
}

/**
 * How audible a discrete reflection should be.
 * Legs use 1/√d so walking toward a bounce raises level (old slap/delta mute did the opposite).
 */
function reflectionAudibility(img) {
  const d1 = Math.max(0.18, img.srcBounce ?? img.dist * 0.5);
  const d2 = Math.max(0.18, img.lisBounce ?? Math.max(0.18, img.dist - d1));
  // Soft floor so very near bounces stay present without exploding
  const leg = (0.85 / Math.sqrt(d1)) * (0.85 / Math.sqrt(d2));
  return Math.max(0.15, Math.min(1.35, leg));
}

function roomWidth() {
  return _S().roomSizeM;
}
function roomDepth() {
  return _S().roomSizeM;
}
function roomHeightM() {
  return _S().roomHeightM;
}
function roomAbsorption() {
  return _S().roomAbs;
}
function roomWetLevel() {
  return _S().roomWet;
}

/** Sabine RT60 estimate. */
function computeRoomMetrics() {
  const w = roomWidth();
  const d = roomDepth();
  const h = roomHeightM();
  const V = w * d * h;
  const S = 2 * (w * d + w * h + d * h);
  const abs = Math.max(0.05, roomAbsorption());
  const A = abs * S;
  const rt60 = (0.161 * V) / Math.max(0.05, A);
  return { w, d, h, V, S, abs, rt60 };
}

/**
 * Build a mono decaying-noise IR from RT60 (room “calculation” → impulse).
 */
function buildRoomIR(rt60) {
  const sr = _eng.ctx.sampleRate;
  const seconds = Math.min(2.8, Math.max(0.25, rt60 * 1.35));
  const len = Math.floor(sr * seconds);
  const buf = _eng.ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  // Skip a bit of direct; start with early energy already handled separately
  const decay = Math.pow(10, -3 / (rt60 * sr)); // ~-60dB over rt60
  let x = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    x = 0.98 * x + white;
    const env = Math.pow(decay, i);
    // High frequencies die faster (air in the room)
    const t = i / len;
    const dull = 1 - 0.55 * t;
    data[i] = x * env * dull * 0.22;
  }
  return buf;
}

// --- shared output bus -----------------------------------------------------

/** @type {AudioContext | null} */
/** @type {ChannelMergerNode | null} */
/** @type {GainNode | null} */
/** @type {ConvolverNode | null} */
/** @type {GainNode | null} */
/** @type {GainNode[]} */
/** @type {DelayNode[]} */
/** @type {GainNode[]} */

/**
 * One spatialized mono voice into the shared merger.
 * mode: 'vbap' | 'foa' | 'ui'
 */

class Voice {
  /**
   * @param {'vbap'|'foa'|'ui'} mode
   */
  constructor(mode) {
    this.mode = mode;
    /** @type {GainNode[]} */
    this.channelGains = [];
    /** @type {GainNode | null} */
    this.input = null;
    /** @type {GainNode | null} */
    this.dryGain = null;
    /** @type {GainNode | null} */
    this.wetSend = null;
    /** @type {BiquadFilterNode | null} */
    this.air = null;
    /** @type {BiquadFilterNode | null} */
    this.occLpf = null;
    /** @type {BiquadFilterNode | null} */
    this.rearLpf = null;
    /** @type {DelayNode[]} */
    this.reflDelays = [];
    /** @type {BiquadFilterNode[]} */
    this.reflHpfs = [];
    /** @type {GainNode[]} */
    this.reflGains = [];
    /** @type {GainNode[][]} */
    this.reflChanGains = [];
    this.x = 0;
    this.y = 0;
    this.z = -2;
    this.level = 1;
    this.lastElev = 0;
    this.lastFloorOcc = 0;
    this._scratch = new Float32Array(16);
    this._reflScratch = new Float32Array(16);
    this.lastGains = new Float32Array(16);
    this.smoothGains = new Float32Array(16);
    this.smoothOcc = 0;
    this.smoothAirHz = 14000;
    this.smoothOccHz = 18000;
    this.smoothRearHz = 16000;
    this.smoothWet = 0;
    this.lastBehind = 0;
    this._lastSpatAt = 0;
    /** @type {{ tag:string|null, gain:number, delay:number, hpf:number, ch:Float32Array, x:number, z:number, bx:number, bz:number, rfl:number, dist:number }[]} */
    this.reflSlots = [];
    this.lastOcc = 0;
    this.lastDryMul = 1;
    this.lastDrySum = 0;
    this.lastReflSum = 0;
    this.lastImages = [];
    this.lastWet = 0;
  }

  attach(channelCount) {
    this.detach();
    this.input = _eng.ctx.createGain();
    this.input.gain.value = 1;

    this.dryGain = _eng.ctx.createGain();
    this.dryGain.gain.value = 1;
    this.wetSend = _eng.ctx.createGain();
    this.wetSend.gain.value = 0;

    // Distance air absorption
    this.air = _eng.ctx.createBiquadFilter();
    this.air.type = "lowpass";
    this.air.Q.value = 0.707;
    this.air.frequency.value = 14000;

    // Occlusion muffling (separate so it lerps cleanly)
    this.occLpf = _eng.ctx.createBiquadFilter();
    this.occLpf.type = "lowpass";
    this.occLpf.Q.value = 0.707;
    this.occLpf.frequency.value = 18000;

    // Front/back head-shadow approximation (dull when behind)
    this.rearLpf = _eng.ctx.createBiquadFilter();
    this.rearLpf.type = "lowpass";
    this.rearLpf.Q.value = 0.707;
    this.rearLpf.frequency.value = 16000;

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.air);
    this.air.connect(this.occLpf);
    this.occLpf.connect(this.rearLpf);
    this.input.connect(this.wetSend);
    if (_eng.roomInput) this.wetSend.connect(_eng.roomInput);

    this.channelGains = [];
    for (let i = 0; i < channelCount; i++) {
      const g = _eng.ctx.createGain();
      g.channelCount = 1;
      g.channelCountMode = "explicit";
      g.gain.value = 0;
      this.rearLpf.connect(g);
      g.connect(_eng.merger, 0, i);
      this.channelGains.push(g);
    }

    // Image-source reflection taps: HPF → gain → speakers (no DelayNode — avoids Doppler while moving)
    this.reflDelays = [];
    this.reflHpfs = [];
    this.reflGains = [];
    this.reflChanGains = [];
    this.reflSlots = [];
    const maxRefl = 8;
    for (let r = 0; r < maxRefl; r++) {
      const hpf = _eng.ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.Q.value = 0.707;
      hpf.frequency.value = 350;
      const g = _eng.ctx.createGain();
      g.gain.value = 0;
      this.input.connect(hpf);
      hpf.connect(g);
      const chans = [];
      for (let i = 0; i < channelCount; i++) {
        const cg = _eng.ctx.createGain();
        cg.gain.value = 0;
        g.connect(cg);
        cg.connect(_eng.merger, 0, i);
        chans.push(cg);
      }
      this.reflHpfs.push(hpf);
      this.reflGains.push(g);
      this.reflChanGains.push(chans);
      this.reflSlots.push({
        tag: null,
        gain: 0,
        delay: 0,
        hpf: 350,
        ch: new Float32Array(16),
        x: 0,
        z: 0,
        bx: 0,
        bz: 0,
        rfl: 0,
        dist: 1,
      });
    }

    this.smoothGains.fill(0);
    this.smoothOcc = 0;
    this.smoothAirHz = 14000;
    this.smoothOccHz = 18000;
    this.smoothRearHz = 16000;
    this.smoothWet = 0;
    this.lastBehind = 0;
    this._lastSpatAt = _eng.ctx.currentTime;
    // Caller (rebuildBus) applies spat once for all voices — avoid N heavy passes on Enable
  }

  detach() {
    for (const g of this.channelGains) {
      try {
        g.disconnect();
      } catch {
        /* noop */
      }
    }
    this.channelGains = [];
    for (const chans of this.reflChanGains) {
      for (const g of chans) {
        try {
          g.disconnect();
        } catch {
          /* noop */
        }
      }
    }
    this.reflChanGains = [];
    for (const n of [...this.reflDelays, ...this.reflHpfs, ...this.reflGains]) {
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
    this.reflDelays = [];
    this.reflHpfs = [];
    this.reflGains = [];
    this.reflSlots = [];
    for (const n of [this.rearLpf, this.occLpf, this.air, this.dryGain, this.wetSend, this.input]) {
      if (!n) continue;
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
    this.rearLpf = null;
    this.occLpf = null;
    this.air = null;
    this.dryGain = null;
    this.wetSend = null;
    this.input = null;
  }

  setPosition(x, z, { apply = true, y } = {}) {
    this.x = x;
    this.z = z;
    if (y != null && Number.isFinite(y)) this.y = y;
    if (apply) this.applySpatial();
  }

  setLevel(level, { apply = true } = {}) {
    this.level = level;
    if (apply) this.applySpatial();
  }

  /** @param {'vbap'|'foa'|'ui'} mode */
  setMode(mode) {
    this.mode = mode;
    this.applySpatial();
  }

  /** Exponential approach factor for frame dt (seconds). */
  _spatAlpha(now) {
    const dt = Math.min(0.05, Math.max(0.001, now - (this._lastSpatAt || now)));
    this._lastSpatAt = now;
    // ~50 ms time constant — continuous while dragging
    return 1 - Math.exp(-dt / 0.05);
  }

  /**
   * Stick reflection images to slots by tag so delay/HPF don't jump when the
   * sorted hit list reorders during motion.
   */
  _assignReflTargets(images) {
    const slots = this.reflSlots;
    const claimed = new Set();
    /** @type {(typeof images[0] | null)[]} */
    const targets = slots.map(() => null);

    // Keep existing tag → slot bindings
    for (let i = 0; i < slots.length; i++) {
      const tag = slots[i].tag;
      if (!tag) continue;
      const idx = images.findIndex((im, j) => !claimed.has(j) && im.tag === tag);
      if (idx >= 0) {
        claimed.add(idx);
        targets[i] = images[idx];
      }
    }

    // Place remaining images into free slots (prefer quieter ones)
    for (let j = 0; j < images.length; j++) {
      if (claimed.has(j)) continue;
      let best = -1;
      let bestGain = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (targets[i]) continue;
        if (slots[i].gain < bestGain) {
          bestGain = slots[i].gain;
          best = i;
        }
      }
      if (best < 0) break;
      targets[best] = images[j];
      claimed.add(j);
    }

    return targets;
  }

  applySpatial() {
    if (!_eng?.ctx || !this.channelGains.length) return;
    const layout = LAYOUTS[_eng.layoutId];
    const n = this.channelGains.length;
    // FOA keeps FC; VBAP skips it so ±1° still phantoms across FL/FR
    const speakersFoa = orbitSpeakers(layout, n);
    const speakersVbap = orbitSpeakers(layout, n, { skipCenter: true });
    const gains = this._scratch.subarray(0, n);
    gains.fill(0);

    const now = _eng.ctx.currentTime;
    const a = this._spatAlpha(now);
    const r = distance3(this.x, this.y, this.z);
    // Ambient beds: no wall occlusion / rear (orbit used to pump level through walls)
    const floorOcc =
      this.mode === "ui" || this.bed ? 0 : computeFloorOcclusion(this.x, this.y, this.z);
    const occTarget =
      this.mode === "ui" || this.bed
        ? 0
        : computeOcclusion(this.x, this.z, this.y);
    this.smoothOcc += (occTarget - this.smoothOcc) * a;
    const occ = this.smoothOcc;
    const elev =
      this.mode === "ui" || this.bed ? 0 : elevationFactor(this.x, this.y, this.z);
    const elevAbs = Math.abs(elev);
    this.lastElev = elev;
    this.lastFloorOcc = floorOcc;

    if (this.mode === "ui") {
      const fc = layout.speakers.find((s) => s.id === "FC" && s.ch < n);
      if (fc) gains[fc.ch] = 1;
      else {
        const fl = layout.speakers.find((s) => s.id === "FL" && s.ch < n);
        const fr = layout.speakers.find((s) => s.id === "FR" && s.ch < n);
        if (fl && fr) {
          gains[fl.ch] = Math.SQRT1_2;
          gains[fr.ch] = Math.SQRT1_2;
        } else if (fl) gains[fl.ch] = 1;
      }
    } else if (this.mode === "foa") {
      foaGains(this.x, this.z, speakersFoa, gains);
      applyNearFieldFill(gains, speakersFoa, nearFieldBlend(r));
    } else {
      vbapGains(this.x, this.z, speakersVbap, gains);
      applyNearFieldFill(gains, speakersVbap, nearFieldBlend(r));
    }

    // Steep elevation: widen image so it doesn't pin hard L/R on a flat ring
    if (this.mode !== "ui" && elevAbs > 0.08) {
      const ring = this.mode === "foa" ? speakersFoa : speakersVbap;
      applyNearFieldFill(gains, ring, Math.min(0.45, elevAbs * 0.4));
      // Nudge a little into FC when present (above/below "overhead" hint)
      const fc = layout.speakers.find((s) => s.id === "FC" && s.ch < n);
      if (fc && elev > 0.15) {
        const boost = elevAbs * 0.22;
        gains[fc.ch] = (gains[fc.ch] || 0) * (1 - boost) + boost;
        let power = 0;
        for (let i = 0; i < n; i++) power += (gains[i] || 0) ** 2;
        const norm = Math.sqrt(power) || 1;
        for (let i = 0; i < n; i++) gains[i] = (gains[i] || 0) / norm;
      }
    }

    // Distance air LPF (bright near → dull far)
    const airTarget = this.mode === "ui" || !_S().air ? 18000 : airCutoffHz(r);
    this.smoothAirHz += (airTarget - this.smoothAirHz) * a;
    if (this.air) this.air.frequency.setValueAtTime(this.smoothAirHz, now);

    // LPF engages harder than gain: thin walls still dull, thick ones go dark.
    // Floor hits add extra muffling even when wall occ is modest.
    const muffle =
      this.mode === "ui" || occ <= 0.02
        ? 0
        : Math.min(
            1,
            0.32 +
              0.68 * Math.pow(Math.min(1, occ / 0.85), 0.6) +
              floorOcc * 0.25
          );
    const elevDark = elevAbs * 0.12; // slight air/ceiling dull when overhead
    const occHzTarget =
      this.mode === "ui"
        ? 18000
        : 17500 - Math.min(1, muffle + elevDark) * (17500 - 1200);
    this.smoothOccHz += (occHzTarget - this.smoothOccHz) * a;
    if (this.occLpf) this.occLpf.frequency.setValueAtTime(this.smoothOccHz, now);

    // Front/back shadow: dull + slightly quieter when behind the listener
    let rear = 0;
    if (this.mode !== "ui" && !this.bed && _S().frontBack) {
      rear = behindAmount(this.x, this.z);
    }
    this.lastBehind = rear;
    // Gentle dulling only (~7 kHz floor) — keep rear sources clearly audible
    const rearHzTarget = this.mode === "ui" ? 18000 : 16000 - rear * (16000 - 7000);
    this.smoothRearHz += (rearHzTarget - this.smoothRearHz) * a;
    if (this.rearLpf) this.rearLpf.frequency.setValueAtTime(this.smoothRearHz, now);

    const dist =
      this.mode === "ui" || !_S().distanceAtten ? 1 : inverseDistance(r);
    // Soft curve — thin walls keep a clear dry path; thick ones still muffle hard
    const dryMul =
      this.mode === "ui" ? 1 : Math.max(0.14, Math.pow(1 - occ, 1.15));
    const rearMul = 1 - 0.1 * rear;
    // Elevation: slightly quieter overhead / underfoot (no height speakers)
    const elevMul = this.mode === "ui" ? 1 : 1 - 0.14 * elevAbs;
    const master = this.level * dist * dryMul * rearMul * elevMul;

    const speakersNear =
      this.mode === "foa" ? speakersFoa : speakersVbap;
    // Don't smear occluded sources into an omni fill — that undoes the wall
    if (this.mode !== "ui" && occ > 0.05 && occ < 0.55 && speakersNear.length) {
      applyNearFieldFill(gains, speakersNear, Math.min(0.25, occ * 0.3));
    }

    let drySum = 0;
    for (let i = 0; i < n; i++) {
      const target = (gains[i] || 0) * master;
      this.smoothGains[i] += (target - this.smoothGains[i]) * a;
      this.lastGains[i] = this.smoothGains[i];
      drySum += this.smoothGains[i];
      this.channelGains[i].gain.setValueAtTime(this.smoothGains[i], now);
    }
    this.lastOcc = occ;
    this.lastDryMul = dryMul;
    this.lastDrySum = drySum;

    // Reflections: sticky slots + lerp gain/HPF/direction (instant — no delay taps)
    const wantRefl = !!_S().occlusion && !this.bed;
    let reflSum = 0;
    if (this.mode !== "ui" && this.reflGains.length && wantRefl) {
      const images = computeImageSources(this.x, this.z);
      const targets = this._assignReflTargets(images);
      // Bounce level follows path legs (source→wall, wall→ears) — not dry range
      const reflMaster =
        this.level *
        (0.5 * (1 - 0.3 * occ) + 0.18) *
        (_S().roomOn ? 0.55 + roomWetLevel() * 0.5 : 0.75);

      const vizImages = [];
      for (let i = 0; i < this.reflSlots.length; i++) {
        const slot = this.reflSlots[i];
        const img = targets[i];
        let gainT = 0;
        let hpfT = slot.hpf;
        const rg = this._reflScratch.subarray(0, n);
        rg.fill(0);

        if (img) {
          slot.tag = img.tag;
          slot.x = img.x;
          slot.z = img.z;
          slot.bx = img.bx;
          slot.bz = img.bz;
          slot.rfl = img.rfl;
          slot.dist = img.dist;
          slot.delay = 0; // geometric delay unused for audio (no DelayNode)
          const hear = reflectionAudibility(img);
          // hear already has 1/√d1·1/√d2 — closer to bounce = louder
          gainT = Math.min(this.level * 0.7, img.rfl * hear * reflMaster);
          const dNear = Math.min(img.srcBounce ?? 1, img.lisBounce ?? 1);
          hpfT = 220 + Math.min(700, dNear * 40);
          vbapGains(img.x, img.z, speakersVbap, rg);
        } else if (slot.gain < 0.01) {
          slot.tag = null;
        }

        slot.gain += (gainT - slot.gain) * a;
        slot.hpf += (hpfT - slot.hpf) * a;
        for (let ch = 0; ch < n; ch++) {
          slot.ch[ch] += ((rg[ch] || 0) - slot.ch[ch]) * a;
          this.reflChanGains[i][ch].gain.setValueAtTime(slot.ch[ch], now);
        }

        this.reflGains[i].gain.setValueAtTime(slot.gain, now);
        if (this.reflHpfs[i]) this.reflHpfs[i].frequency.setValueAtTime(slot.hpf, now);
        reflSum += slot.gain;

        if (img && reflectionAudibility(img) > 0.08) {
          vizImages.push({
            x: slot.x,
            z: slot.z,
            bx: slot.bx,
            bz: slot.bz,
            rfl: slot.rfl * reflectionAudibility(img),
            dist: slot.dist,
            delay: 0,
            tag: slot.tag,
            gain: slot.gain,
            hear: reflectionAudibility(img),
          });
        }
      }
      this.lastImages = vizImages;
    } else if (this.reflGains.length) {
      this.lastImages = [];
      for (let i = 0; i < this.reflSlots.length; i++) {
        const slot = this.reflSlots[i];
        slot.gain += (0 - slot.gain) * a;
        slot.tag = slot.gain < 0.01 ? null : slot.tag;
        this.reflGains[i].gain.setValueAtTime(slot.gain, now);
        for (let ch = 0; ch < n; ch++) {
          slot.ch[ch] += (0 - slot.ch[ch]) * a;
          this.reflChanGains[i][ch].gain.setValueAtTime(slot.ch[ch], now);
        }
      }
    }
    this.lastReflSum = reflSum;

    if (this.wetSend) {
      let wetT = 0;
      if (this.mode !== "ui" && _S().roomOn) {
        const distWet = Math.min(1.2, 0.35 + r * 0.14);
        // Don't dump more reverb when the dry path is walled off
        wetT = roomWetLevel() * this.level * distWet * (0.7 * (1 - 0.65 * occ) + 0.1);
      }
      this.smoothWet += (wetT - this.smoothWet) * a;
      this.lastWet = this.smoothWet;
      this.wetSend.gain.setValueAtTime(this.smoothWet, now);
    }
  }

  /**
   * @param {AudioBuffer} buffer
   * @param {{ loop?: boolean, when?: number }} [opts]
   */
  play(buffer, opts = {}) {
    if (!this.input) return null;
    const src = _eng.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = Boolean(opts.loop);
    src.connect(this.input);
    src.start(opts.when ?? 0);
    return src;
  }
}


function toMono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer;
  const out = _eng.ctx.createBuffer(1, buffer.length, buffer.sampleRate);
  const dest = out.getChannelData(0);
  const n = buffer.numberOfChannels;
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < buffer.length; i++) dest[i] += ch[i] / n;
  }
  return out;
}

// --- output graph ----------------------------------------------------------

function configureDestination(channelCount) {
  const dest = _eng.ctx.destination;
  _eng.deviceMax = dest.maxChannelCount || 2;
  const n = Math.min(channelCount, _eng.deviceMax);
  try {
    dest.channelCount = n;
    dest.channelCountMode = "explicit";
    dest.channelInterpretation = "discrete";
  } catch (err) {
    console.warn(err);
  }
  _eng.activeChannels = dest.channelCount;
  return _eng.activeChannels;
}

function teardownRoom() {
  for (const g of _eng.roomDiffuseGains) {
    try {
      g.disconnect();
    } catch {
      /* noop */
    }
  }
  _eng.roomDiffuseGains = [];
  for (const n of [..._eng.earlyDelays, ..._eng.earlyGains]) {
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
  }
  _eng.earlyDelays = [];
  _eng.earlyGains = [];
  for (const n of [_eng.roomWetGain, _eng.roomConvolver, _eng.roomInput]) {
    if (!n) continue;
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
  }
  _eng.roomWetGain = null;
  _eng.roomConvolver = null;
  _eng.roomInput = null;
}

function updateRoomStatsUI(metrics) {
  if (typeof _eng?.onRoomStats === "function") _eng.onRoomStats(metrics);
}

/** Shared room bus: early reflections + Sabine-driven convolver IR → all speakers. */
function buildRoom(n) {
  teardownRoom();
  const metrics = computeRoomMetrics();
  _eng.roomInput = _eng.ctx.createGain();
  _eng.roomInput.gain.value = 1;

  _eng.roomConvolver = _eng.ctx.createConvolver();
  _eng.roomConvolver.normalize = true;
  _eng.roomConvolver.buffer = buildRoomIR(metrics.rt60);

  _eng.roomWetGain = _eng.ctx.createGain();
  _eng.roomWetGain.gain.value = _S().roomOn ? roomWetLevel() * 0.85 : 0;

  _eng.roomInput.connect(_eng.roomConvolver);
  _eng.roomConvolver.connect(_eng.roomWetGain);

  const omni = 1 / Math.sqrt(Math.max(1, n));
  _eng.roomDiffuseGains = [];
  for (let i = 0; i < n; i++) {
    const g = _eng.ctx.createGain();
    g.gain.value = omni;
    _eng.roomWetGain.connect(g);
    g.connect(_eng.merger, 0, i);
    _eng.roomDiffuseGains.push(g);
  }

  // Early room taps: directional, instantaneous (no DelayNode — no Doppler while moving)
  const halfW = metrics.w / 2;
  const halfD = metrics.d / 2;
  const earlyLevel = 0.14 * (1 - metrics.abs);
  const speakers = orbitSpeakers(LAYOUTS[_eng.layoutId], n, { skipCenter: true });
  // Arrival angles toward each room wall from the current listener seat
  const roomDirs = [
    { x: _L().x + halfW, z: _L().z }, // right
    { x: _L().x - halfW, z: _L().z }, // left
    { x: _L().x, z: _L().z + halfD }, // back
    { x: _L().x, z: _L().z - halfD }, // front
  ];

  for (let i = 0; i < roomDirs.length; i++) {
    const g = _eng.ctx.createGain();
    g.gain.value = _S().roomOn ? earlyLevel * (1 - i * 0.12) : 0;
    _eng.roomInput.connect(g);
    _eng.earlyGains.push(g);

    const scratch = new Float32Array(n);
    if (speakers.length && roomDirs[i]) {
      vbapGains(roomDirs[i].x, roomDirs[i].z, speakers, scratch);
    }
    for (let ch = 0; ch < n; ch++) {
      const w = scratch[ch] || (speakers.length ? 0 : omni);
      if (w < 0.04) continue;
      const cg = _eng.ctx.createGain();
      cg.gain.value = w;
      g.connect(cg);
      cg.connect(_eng.merger, 0, ch);
      _eng.earlyGains.push(cg);
    }
  }

  updateRoomStatsUI(metrics);
}

function refreshRoomFromUI() {
  if (!_eng?.ctx || !_eng.merger) return;
  const metrics = computeRoomMetrics();
  updateRoomStatsUI(metrics);
  if (_eng.roomConvolver) {
    _eng.roomConvolver.buffer = buildRoomIR(metrics.rt60);
  }
  if (_eng.roomWetGain) {
    _eng.roomWetGain.gain.value = _S().roomOn ? roomWetLevel() * 0.85 : 0;
  }
  const earlyLevel = _S().roomOn ? 0.14 * (1 - metrics.abs) : 0;
  // Rebuild early directional taps when size/abs changes
  if (_eng.activeChannels) {
    // light rebuild of room only
    const n = _eng.activeChannels;
    // disconnect early only and rebuild
    for (const node of [..._eng.earlyDelays, ..._eng.earlyGains]) {
      try {
        node.disconnect();
      } catch {
        /* noop */
      }
    }
    _eng.earlyDelays = [];
    _eng.earlyGains = [];
    const halfW = metrics.w / 2;
    const halfD = metrics.d / 2;
    const speakers = orbitSpeakers(LAYOUTS[_eng.layoutId], n, { skipCenter: true });
    const roomDirs = [
      { x: _L().x + halfW, z: _L().z },
      { x: _L().x - halfW, z: _L().z },
      { x: _L().x, z: _L().z + halfD },
      { x: _L().x, z: _L().z - halfD },
    ];
    const omni = 1 / Math.sqrt(n);
    for (let i = 0; i < roomDirs.length; i++) {
      const g = _eng.ctx.createGain();
      g.gain.value = earlyLevel * (1 - i * 0.12);
      _eng.roomInput.connect(g);
      _eng.earlyGains.push(g);
      const scratch = new Float32Array(n);
      if (speakers.length && roomDirs[i]) {
        vbapGains(roomDirs[i].x, roomDirs[i].z, speakers, scratch);
      }
      for (let ch = 0; ch < n; ch++) {
        const w = scratch[ch] || (speakers.length ? 0 : omni);
        if (w < 0.04) continue;
        const cg = _eng.ctx.createGain();
        cg.gain.value = w;
        g.connect(cg);
        cg.connect(_eng.merger, 0, ch);
        _eng.earlyGains.push(cg);
      }
    }
  }
}



export {
  LAYOUTS,
  LISTENER_EAR_Y,
  Voice,
  behindAmount,
  orbitSpeakers,
  speakerWorldPos,
};

export class SurroundEngine {
  constructor() {
    _eng = this;
    this.listener = { x: 0, z: 0, yaw: 0, y: LISTENER_EAR_Y };
    this.occluders = [];
    this.settings = {
      air: true,
      distanceAtten: true,
      nearField: true,
      occlusion: true,
      floorOcc: true,
      frontBack: true,
      roomOn: false,
      floorHeightM: 2.8,
      roomSizeM: 8,
      roomHeightM: 3,
      roomAbs: 0.35,
      roomWet: 0.25,
    };
    this.layoutId = "51";
    this.ctx = null;
    this.merger = null;
    this.roomInput = null;
    this.roomConvolver = null;
    this.roomWetGain = null;
    this.roomDiffuseGains = [];
    this.earlyDelays = [];
    this.earlyGains = [];
    this.deviceMax = 0;
    this.activeChannels = 0;
    this.bufferCache = new Map();
    /** @type {Set<Voice>} */
    this.voices = new Set();
  }

  use() {
    _eng = this;
    return this;
  }

  async ensureContext() {
    this.use();
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  setSettings(partial) {
    Object.assign(this.settings, partial);
  }

  setListener(x, z, yaw) {
    if (x != null) this.listener.x = x;
    if (z != null) this.listener.z = z;
    if (yaw != null) this.listener.yaw = yaw;
  }

  setOccluders(list) {
    this.occluders = list;
  }

  setLayout(id) {
    if (LAYOUTS[id]) this.layoutId = id;
  }

  /**
   * @param {"vbap"|"foa"|"ui"} mode
   * @param {{ bed?: boolean }} [opts]
   */
  createVoice(mode, opts = {}) {
    this.use();
    const v = new Voice(mode);
    if (opts.bed) v.bed = true;
    this.voices.add(v);
    if (this.merger && this.activeChannels) v.attach(this.activeChannels);
    return v;
  }

  detachVoice(v) {
    if (!v) return;
    v.detach();
    this.voices.delete(v);
  }

  async loadBuffer(url) {
    await this.ensureContext();
    if (this.bufferCache.has(url)) return this.bufferCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed ${url}`);
    const ab = await res.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(ab.slice(0));
    const mono = toMono(decoded);
    this.bufferCache.set(url, mono);
    return mono;
  }

  clearBuffer(url) {
    this.bufferCache.delete(url);
  }

  rebuildGraph() {
    this.use();
    for (const v of this.voices) v.detach();
    teardownRoom();
    if (this.merger) {
      try {
        this.merger.disconnect();
      } catch {
        /* noop */
      }
      this.merger = null;
    }
    const layout = LAYOUTS[this.layoutId];
    const n = configureDestination(layout.channels);
    this.merger = this.ctx.createChannelMerger(n);
    this.merger.channelInterpretation = "discrete";
    this.merger.connect(this.ctx.destination);
    buildRoom(n);
    for (const v of this.voices) v.attach(n);
    return n;
  }

  refreshRoom() {
    this.use();
    if (!this.ctx || !this.merger) return;
    refreshRoomFromUI();
  }

  applyAll() {
    this.use();
    for (const v of this.voices) v.applySpatial();
  }

  floorDeckY() {
    return this.settings.floorHeightM;
  }

  get layout() {
    return LAYOUTS[this.layoutId];
  }
}

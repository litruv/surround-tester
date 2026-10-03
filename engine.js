/**
 * Surround Mixer — concurrent VBAP + FOA + UI buses into one ChannelMerger.
 *
 * - FOA: rainforest bed (several virtual beds decoded with Ambisonics)
 * - VBAP: footsteps seeking random targets (accel / decelerate into approach)
 * - UI: dry center/front hits (no spatializer)
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** @typedef {{ id: string, ch: number, angle: number, isLfe?: boolean }} Speaker */

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

const SAMPLE_URLS = {
  rainforest: "./sounds/rainforest.mp3",
  waterfall: "./sounds/waterfall.wav",
  stream: "./sounds/stream_long.mp3",
  foot1: "./sounds/footstep1.mp3",
  foot2: "./sounds/footstep2.mp3",
  bird1: "./sounds/bird1.mp3",
  bird2: "./sounds/bird2.mp3",
  bird3: "./sounds/bird3.mp3",
  birdForest: "./sounds/bird_try_2465.mp3",
  flap1: "./sounds/flap_single_a.wav",
  flap2: "./sounds/flap_single_b.wav",
  flapBurst1: "./sounds/flap1.wav",
  flapBurst2: "./sounds/flap2.wav",
  uiClick: "./sounds/ui_click.mp3",
  uiOk: "./sounds/ui_confirm.mp3",
  uiPop: "./sounds/pop.ogg",
};

const els = {
  status: document.getElementById("status"),
  btnStart: document.getElementById("btn-start"),
  btnStop: document.getElementById("btn-stop"),
  layout: document.getElementById("layout"),
  caps: document.getElementById("caps"),
  compat: document.getElementById("compat"),
  air: document.getElementById("air"),
  distanceAtten: document.getElementById("distance-atten"),
  nearField: document.getElementById("near-field"),
  occlusion: document.getElementById("occlusion"),
  frontBack: document.getElementById("front-back"),
  roomOn: document.getElementById("room-on"),
  roomSize: document.getElementById("room-size"),
  roomSizeOut: document.getElementById("room-size-out"),
  roomHeight: document.getElementById("room-height"),
  roomHeightOut: document.getElementById("room-height-out"),
  roomAbs: document.getElementById("room-abs"),
  roomAbsOut: document.getElementById("room-abs-out"),
  roomWet: document.getElementById("room-wet"),
  roomWetOut: document.getElementById("room-wet-out"),
  roomStats: document.getElementById("room-stats"),
  vizOn: document.getElementById("viz-on"),
  vizFocus: document.getElementById("viz-focus"),
  ambiOn: document.getElementById("ambi-on"),
  ambiVol: document.getElementById("ambi-vol"),
  ambiVolOut: document.getElementById("ambi-vol-out"),
  ambiDrift: document.getElementById("ambi-drift"),
  ambiDriftOut: document.getElementById("ambi-drift-out"),
  walkOn: document.getElementById("walk-on"),
  walkVol: document.getElementById("walk-vol"),
  walkVolOut: document.getElementById("walk-vol-out"),
  walkSpeed: document.getElementById("walk-speed"),
  walkSpeedOut: document.getElementById("walk-speed-out"),
  walkStride: document.getElementById("walk-stride"),
  walkStrideOut: document.getElementById("walk-stride-out"),
  walkRadius: document.getElementById("walk-radius"),
  walkRadiusOut: document.getElementById("walk-radius-out"),
  uiVol: document.getElementById("ui-vol"),
  uiVolOut: document.getElementById("ui-vol-out"),
  btnUiClick: document.getElementById("btn-ui-click"),
  btnUiOk: document.getElementById("btn-ui-ok"),
  btnUiPop: document.getElementById("btn-ui-pop"),
  fallOn: document.getElementById("fall-on"),
  fallVol: document.getElementById("fall-vol"),
  fallVolOut: document.getElementById("fall-vol-out"),
  fallSpatial: document.getElementById("fall-spatial"),
  fallSound: document.getElementById("fall-sound"),
  birdOn: document.getElementById("bird-on"),
  birdCount: document.getElementById("bird-count"),
  birdCountOut: document.getElementById("bird-count-out"),
  birdVol: document.getElementById("bird-vol"),
  birdVolOut: document.getElementById("bird-vol-out"),
  birdSpatial: document.getElementById("bird-spatial"),
  birdSound: document.getElementById("bird-sound"),
  birdRate: document.getElementById("bird-rate"),
  birdRateOut: document.getElementById("bird-rate-out"),
  birdFly: document.getElementById("bird-fly"),
  birdFlyOut: document.getElementById("bird-fly-out"),
  wallCount: document.getElementById("wall-count"),
  perfStats: document.getElementById("perf-stats"),
  wallList: document.getElementById("wall-list"),
  sceneJson: document.getElementById("scene-json"),
  btnExportScene: document.getElementById("btn-export-scene"),
  btnImportScene: document.getElementById("btn-import-scene"),
  btnLoadDefault: document.getElementById("btn-load-default"),
  btnCopyScene: document.getElementById("btn-copy-scene"),
  btnPasteScene: document.getElementById("btn-paste-scene"),
  btnAddWall: document.getElementById("btn-add-wall"),
  btnRemoveWall: document.getElementById("btn-remove-wall"),
  btnAddWallPanel: document.getElementById("btn-add-wall-panel"),
  btnRemoveWallPanel: document.getElementById("btn-remove-wall-panel"),
  btnApplyJson: document.getElementById("btn-apply-json"),
  btnRefreshJson: document.getElementById("btn-refresh-json"),
  toolAddWall: document.getElementById("tool-add-wall"),
  toolOrbit: document.getElementById("tool-orbit"),
};

const canvas = document.getElementById("view");

/**
 * Listener world pose.
 * yaw is Three.js rotation.y on the mesh (nose = local −Z).
 * After Ry(yaw), nose points (−sin(yaw), −cos(yaw)) in XZ — yaw 0 = world −Z.
 */
const listener = { x: 0, z: 0, yaw: 0 };

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

function xzToAngle(x, z) {
  // 0 = listener front, + = right — respects current yaw
  const d = toListenerBasis(x, z);
  return Math.atan2(d.x, d.y);
}

function distance2(x, z) {
  return Math.hypot(x - listener.x, z - listener.z);
}

/** Unit vector in listener-local basis: x = right, y = front (nose). */
function toListenerBasis(worldX, worldZ) {
  const dx = worldX - listener.x;
  const dz = worldZ - listener.z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / len;
  const uz = dz / len;
  // Match Three.js Ry(yaw): local −Z → (−sin, −cos), local +X → (cos, −sin)
  const fwdX = -Math.sin(listener.yaw);
  const fwdZ = -Math.cos(listener.yaw);
  const rightX = Math.cos(listener.yaw);
  const rightZ = -Math.sin(listener.yaw);
  return {
    x: ux * rightX + uz * rightZ,
    y: ux * fwdX + uz * fwdZ,
    len,
  };
}

/** Smoothly ease listener.yaw toward targetYaw (rad). */
function smoothListenerYaw(dt, targetYaw, sharpness = 5.5) {
  const d = shortestAngleDelta(listener.yaw, targetYaw);
  const t = 1 - Math.exp(-sharpness * dt);
  listener.yaw = normalizeAngle(listener.yaw + d * t);
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
  if (!els.air?.checked) return 18000;
  const t = Math.min(1, Math.max(0, (r - 0.5) / 7.5));
  return 14500 - t * 12000; // ~14.5 kHz near → ~2.5 kHz far
}

/**
 * How much to widen toward omnidirectional as the source approaches the listener.
 * 0 = fully directional, 1 = equal-power on all surround speakers.
 */
function nearFieldBlend(r) {
  if (!els.nearField?.checked) return 0;
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

/** Mutable occluder AABBs on XZ (draggable / resizable walls). */
let occluders = [
  // Kept clear of the listener + typical spawn ring
  { x0: -3.4, z0: -0.5, x1: -1.8, z1: 0.25 },
  { x0: 1.9, z0: -3.2, x1: 3.5, z1: -2.5 },
];

/** Index into occluders for UI selection / delete. */
let selectedWallIndex = -1;

function getOccluderAABBs() {
  return occluders;
}

function roundScene(n, digits = 3) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function serializeScene(name = "scene") {
  const walls = occluders.map((o) => ({
    x0: roundScene(o.x0),
    z0: roundScene(o.z0),
    x1: roundScene(o.x1),
    z1: roundScene(o.z1),
  }));
  const birdPositions = birds.map((b) => ({
    x: roundScene(b.x),
    z: roundScene(b.z),
    y: roundScene(b.y ?? 1.2),
  }));
  return {
    version: 1,
    name,
    speakerLayout: els.layout?.value || "51",
    listener: { x: roundScene(listener.x), z: roundScene(listener.z) },
    waterfall: {
      x: roundScene(waterfallMesh.position.x),
      z: roundScene(waterfallMesh.position.z),
      on: !!els.fallOn?.checked,
      vol: Number(els.fallVol?.value ?? 45),
      spatial: els.fallSpatial?.value || "foa",
      sound: els.fallSound?.value || "waterfall",
    },
    walls,
    birds: birdPositions,
    room: {
      size: Number(els.roomSize?.value ?? 80),
      height: Number(els.roomHeight?.value ?? 30),
      abs: Number(els.roomAbs?.value ?? 35),
      wet: Number(els.roomWet?.value ?? 25),
      on: !!els.roomOn?.checked,
    },
  };
}

function sceneToJson(name) {
  return JSON.stringify(serializeScene(name), null, 2);
}

function refreshSceneJsonField() {
  if (els.sceneJson) els.sceneJson.value = sceneToJson("current");
}

function refreshWallList() {
  if (els.wallCount) els.wallCount.textContent = `Walls: ${occluders.length}`;
  if (!els.wallList) return;
  els.wallList.innerHTML = "";
  occluders.forEach((o, i) => {
    const li = document.createElement("li");
    if (i === selectedWallIndex) li.classList.add("selected");
    const cx = roundScene((o.x0 + o.x1) / 2, 2);
    const cz = roundScene((o.z0 + o.z1) / 2, 2);
    const w = roundScene(o.x1 - o.x0, 2);
    const d = roundScene(o.z1 - o.z0, 2);
    const label = document.createElement("span");
    label.textContent = `#${i + 1}  (${cx}, ${cz})  ${w}×${d} m`;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Del";
    del.title = "Remove wall";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeWallAt(i);
    });
    li.addEventListener("click", () => {
      selectedWallIndex = i;
      highlightSelectedWall();
      refreshWallList();
    });
    li.append(label, del);
    els.wallList.appendChild(li);
  });
}

function highlightSelectedWall() {
  for (let i = 0; i < wallGroups.length; i++) {
    const g = wallGroups[i];
    const body = g?.userData?.body;
    if (!body?.material) continue;
    const selected = i === selectedWallIndex;
    body.material.color.setHex(selected ? 0x3b82f6 : 0x64748b);
    body.material.opacity = selected ? 0.72 : 0.55;
    body.material.emissive?.setHex?.(selected ? 0x1d4ed8 : 0x000000);
    if (body.material.emissiveIntensity != null) {
      body.material.emissiveIntensity = selected ? 0.35 : 0;
    }
  }
}

function addWall(at = null) {
  const cx = at?.x ?? listener.x + 1.6;
  const cz = at?.z ?? listener.z - 1.2;
  const hw = 0.7;
  const hd = 0.35;
  occluders.push({
    x0: cx - hw,
    z0: cz - hd,
    x1: cx + hw,
    z1: cz + hd,
  });
  selectedWallIndex = occluders.length - 1;
  rebuildWallMeshes();
  refreshAcoustics();
  refreshSceneJsonField();
  setStatus(`Wall ${occluders.length} added`);
}

function removeWallAt(index) {
  if (index < 0 || index >= occluders.length) return;
  occluders.splice(index, 1);
  if (selectedWallIndex === index) selectedWallIndex = -1;
  else if (selectedWallIndex > index) selectedWallIndex -= 1;
  rebuildWallMeshes();
  refreshAcoustics();
  refreshSceneJsonField();
  setStatus(occluders.length ? `Wall removed (${occluders.length} left)` : "All walls removed");
}

function removeSelectedOrLastWall() {
  if (selectedWallIndex >= 0) removeWallAt(selectedWallIndex);
  else if (occluders.length) removeWallAt(occluders.length - 1);
}

function applyRoomFromScene(room) {
  if (!room) return;
  if (room.size != null && els.roomSize) els.roomSize.value = String(room.size);
  if (room.height != null && els.roomHeight) els.roomHeight.value = String(room.height);
  if (room.abs != null && els.roomAbs) els.roomAbs.value = String(room.abs);
  if (room.wet != null && els.roomWet) els.roomWet.value = String(room.wet);
  if (room.on != null && els.roomOn) els.roomOn.checked = !!room.on;
  updateLabels();
  if (typeof refreshRoomFromUI === "function") refreshRoomFromUI();
}

function applyScene(data, { quiet = false } = {}) {
  if (!data || typeof data !== "object") throw new Error("Invalid scene JSON");
  if (data.speakerLayout && els.layout && LAYOUTS[data.speakerLayout]) {
    const prev = els.layout.value;
    els.layout.value = data.speakerLayout;
    if (prev !== data.speakerLayout) {
      els.layout.dispatchEvent(new Event("change"));
    }
  }
  if (data.listener) {
    setListenerPosition(Number(data.listener.x) || 0, Number(data.listener.z) || 0);
  }
  if (data.waterfall && waterfallMesh) {
    const w = data.waterfall;
    if (w.x != null || w.z != null) {
      waterfallMesh.position.set(Number(w.x) || 0, 0, Number(w.z) || 0);
    }
    if (w.on != null && els.fallOn) els.fallOn.checked = !!w.on;
    if (w.vol != null && els.fallVol) els.fallVol.value = String(w.vol);
    if (w.spatial && els.fallSpatial) {
      els.fallSpatial.value = w.spatial;
      if (waterfallVoice) waterfallVoice.setMode(w.spatial);
    }
    if (w.sound && els.fallSound) els.fallSound.value = w.sound;
    updateLabels();
    syncWaterfallVisual();
    syncLevels();
    if (sceneRunning && els.fallOn?.checked) startWaterfall();
    else if (sceneRunning && !els.fallOn?.checked) stopWaterfall();
  }
  if (Array.isArray(data.walls)) {
    occluders = data.walls.map((w) => ({
      x0: Number(w.x0),
      z0: Number(w.z0),
      x1: Number(w.x1),
      z1: Number(w.z1),
    }));
    selectedWallIndex = occluders.length ? 0 : -1;
    rebuildWallMeshes();
  }
  if (Array.isArray(data.birds) && data.birds.length && birds.length) {
    const n = Math.min(birds.length, data.birds.length);
    for (let i = 0; i < n; i++) {
      birds[i].x = Number(data.birds[i].x) || birds[i].x;
      birds[i].z = Number(data.birds[i].z) || birds[i].z;
      if (data.birds[i].y != null) birds[i].y = Number(data.birds[i].y);
      birds[i].speed = 0;
      birds[i].dragHold = 0.2;
      if (birdVoices[i]) birdVoices[i].setPosition(birds[i].x, birds[i].z, { apply: false });
    }
    syncBirdMeshes();
  }
  applyRoomFromScene(data.room);
  refreshAcoustics();
  bumpSpatSettle(12);
  refreshSceneJsonField();
  if (!quiet) setStatus(`Loaded “${data.name || "scene"}”`);
}

async function copySceneToClipboard() {
  const text = sceneToJson("export");
  refreshSceneJsonField();
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Scene copied");
  } catch {
    if (els.sceneJson) {
      els.sceneJson.focus();
      els.sceneJson.select();
      setStatus("Copy from Scene tab (clipboard blocked)");
    }
  }
}

async function pasteSceneFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    applyScene(JSON.parse(text));
  } catch (err) {
    if (els.sceneJson?.value?.trim()) {
      try {
        applyScene(JSON.parse(els.sceneJson.value));
        return;
      } catch {
        /* fall through */
      }
    }
    setStatus("Paste failed — use Scene tab JSON");
    console.warn(err);
  }
}

async function loadDefaultLayout() {
  try {
    const res = await fetch(`./layouts/default.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    applyScene(data);
    setStatus("Default layout loaded");
  } catch (err) {
    setStatus("Could not load default.json");
    console.warn(err);
  }
}

function pointInExpandedRect(px, pz, r, margin) {
  return (
    px >= r.x0 - margin &&
    px <= r.x1 + margin &&
    pz >= r.z0 - margin &&
    pz <= r.z1 + margin
  );
}

function isInsideWall(x, z, margin = 0.3) {
  for (const o of occluders) {
    if (pointInExpandedRect(x, z, o, margin)) return true;
  }
  return false;
}

/** Random clear ground point (not inside walls / listener). */
function randomClearPoint(minR, maxR, margin = 0.35) {
  for (let tries = 0; tries < 40; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = listener.x + Math.sin(ang) * r;
    const z = listener.z - Math.cos(ang) * r;
    if (Math.hypot(x - listener.x, z - listener.z) < 0.55) continue;
    if (!isInsideWall(x, z, margin)) return { x, z };
  }
  return {
    x: listener.x,
    z: listener.z - Math.max(2.5, maxR * 0.7),
  };
}

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const det = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(det) < 1e-9) return false;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / det;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointInRect(px, pz, r) {
  return px >= r.x0 && px <= r.x1 && pz >= r.z0 && pz <= r.z1;
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
 * Continuous occlusion 0..1.
 * Scales with path length through the wall — thin slabs muffle, thick ones mute.
 * Corner/grazing softens further (diffraction).
 */
function computeOcclusion(x, z) {
  if (!els.occlusion?.checked) return 0;
  const lx = listener.x;
  const lz = listener.z;
  if (Math.hypot(x - lx, z - lz) < 0.08) return 0;

  const srcAng = Math.atan2(x - lx, -(z - lz));
  const softAng = 0.55;
  let blocked = 0;

  for (const o of occluders) {
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

  return blocked;
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
  const lx = listener.x;
  const lz = listener.z;
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

  for (const o of occluders) {
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

  for (let i = 0; i < occluders.length; i++) {
    const segs = occluderReflectSegments(occluders[i]);
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
  return Number(els.roomSize.value) / 10;
}
function roomDepth() {
  return Number(els.roomSize.value) / 10;
}
function roomHeightM() {
  return Number(els.roomHeight.value) / 10;
}
function roomAbsorption() {
  return Number(els.roomAbs.value) / 100;
}
function roomWetLevel() {
  return Number(els.roomWet.value) / 100;
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
  const sr = ctx.sampleRate;
  const seconds = Math.min(2.8, Math.max(0.25, rt60 * 1.35));
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
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
let ctx = null;
/** @type {ChannelMergerNode | null} */
let merger = null;
/** @type {GainNode | null} */
let roomInput = null;
/** @type {ConvolverNode | null} */
let roomConvolver = null;
/** @type {GainNode | null} */
let roomWetGain = null;
/** @type {GainNode[]} */
let roomDiffuseGains = [];
/** @type {DelayNode[]} */
let earlyDelays = [];
/** @type {GainNode[]} */
let earlyGains = [];
let deviceMax = 0;
let activeChannels = 0;
let audioReady = false;
let sceneRunning = false;

const bufferCache = new Map();

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
    this.z = -2;
    this.level = 1;
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
    this.input = ctx.createGain();
    this.input.gain.value = 1;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1;
    this.wetSend = ctx.createGain();
    this.wetSend.gain.value = 0;

    // Distance air absorption
    this.air = ctx.createBiquadFilter();
    this.air.type = "lowpass";
    this.air.Q.value = 0.707;
    this.air.frequency.value = 14000;

    // Occlusion muffling (separate so it lerps cleanly)
    this.occLpf = ctx.createBiquadFilter();
    this.occLpf.type = "lowpass";
    this.occLpf.Q.value = 0.707;
    this.occLpf.frequency.value = 18000;

    // Front/back head-shadow approximation (dull when behind)
    this.rearLpf = ctx.createBiquadFilter();
    this.rearLpf.type = "lowpass";
    this.rearLpf.Q.value = 0.707;
    this.rearLpf.frequency.value = 16000;

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.air);
    this.air.connect(this.occLpf);
    this.occLpf.connect(this.rearLpf);
    this.input.connect(this.wetSend);
    if (roomInput) this.wetSend.connect(roomInput);

    this.channelGains = [];
    for (let i = 0; i < channelCount; i++) {
      const g = ctx.createGain();
      g.channelCount = 1;
      g.channelCountMode = "explicit";
      g.gain.value = 0;
      this.rearLpf.connect(g);
      g.connect(merger, 0, i);
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
      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.Q.value = 0.707;
      hpf.frequency.value = 350;
      const g = ctx.createGain();
      g.gain.value = 0;
      this.input.connect(hpf);
      hpf.connect(g);
      const chans = [];
      for (let i = 0; i < channelCount; i++) {
        const cg = ctx.createGain();
        cg.gain.value = 0;
        g.connect(cg);
        cg.connect(merger, 0, i);
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
    this._lastSpatAt = ctx.currentTime;
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

  setPosition(x, z, { apply = true } = {}) {
    this.x = x;
    this.z = z;
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
    if (!ctx || !this.channelGains.length) return;
    const layout = LAYOUTS[els.layout.value];
    const n = this.channelGains.length;
    // FOA keeps FC; VBAP skips it so ±1° still phantoms across FL/FR
    const speakersFoa = orbitSpeakers(layout, n);
    const speakersVbap = orbitSpeakers(layout, n, { skipCenter: true });
    const gains = this._scratch.subarray(0, n);
    gains.fill(0);

    const now = ctx.currentTime;
    const a = this._spatAlpha(now);
    const r = distance2(this.x, this.z);
    const occTarget = this.mode === "ui" ? 0 : computeOcclusion(this.x, this.z);
    this.smoothOcc += (occTarget - this.smoothOcc) * a;
    const occ = this.smoothOcc;

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

    // Distance air LPF (bright near → dull far)
    const airTarget = this.mode === "ui" || !els.air?.checked ? 18000 : airCutoffHz(r);
    this.smoothAirHz += (airTarget - this.smoothAirHz) * a;
    if (this.air) this.air.frequency.setValueAtTime(this.smoothAirHz, now);

    // LPF engages harder than gain: thin walls still dull, thick ones go dark
    const muffle =
      this.mode === "ui" || occ <= 0.02
        ? 0
        : Math.min(1, 0.32 + 0.68 * Math.pow(Math.min(1, occ / 0.85), 0.6));
    const occHzTarget = this.mode === "ui" ? 18000 : 17500 - muffle * (17500 - 1400);
    this.smoothOccHz += (occHzTarget - this.smoothOccHz) * a;
    if (this.occLpf) this.occLpf.frequency.setValueAtTime(this.smoothOccHz, now);

    // Front/back shadow: dull + slightly quieter when behind the listener
    let rear = 0;
    if (this.mode !== "ui" && els.frontBack?.checked) {
      rear = behindAmount(this.x, this.z);
    }
    this.lastBehind = rear;
    // Gentle dulling only (~7 kHz floor) — keep rear sources clearly audible
    const rearHzTarget = this.mode === "ui" ? 18000 : 16000 - rear * (16000 - 7000);
    this.smoothRearHz += (rearHzTarget - this.smoothRearHz) * a;
    if (this.rearLpf) this.rearLpf.frequency.setValueAtTime(this.smoothRearHz, now);

    const dist =
      this.mode === "ui" || !els.distanceAtten?.checked ? 1 : inverseDistance(r);
    // Soft curve — thin walls keep a clear dry path; thick ones still muffle hard
    const dryMul =
      this.mode === "ui" ? 1 : Math.max(0.14, Math.pow(1 - occ, 1.15));
    const rearMul = 1 - 0.1 * rear;
    const master = this.level * dist * dryMul * rearMul;

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
    const wantRefl = !!els.occlusion?.checked;
    let reflSum = 0;
    if (this.mode !== "ui" && this.reflGains.length && wantRefl) {
      const images = computeImageSources(this.x, this.z);
      const targets = this._assignReflTargets(images);
      // Bounce level follows path legs (source→wall, wall→ears) — not dry range
      const reflMaster =
        this.level *
        (0.5 * (1 - 0.3 * occ) + 0.18) *
        (els.roomOn?.checked ? 0.55 + roomWetLevel() * 0.5 : 0.75);

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
      if (this.mode !== "ui" && els.roomOn?.checked) {
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
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = Boolean(opts.loop);
    src.connect(this.input);
    src.start(opts.when ?? 0);
    return src;
  }
}

// Ambient uses several FOA Voices at fixed offsets; walker is one VBAP Voice; UI is one Voice.
/** @type {Voice[]} */
let ambiVoices = [];
/** @type {AudioBufferSourceNode[]} */
let ambiSources = [];
/** @type {Voice | null} */
let walkVoice = null;
/** @type {Voice | null} */
let uiVoice = null;
/** @type {Voice | null} */
let waterfallVoice = null;
/** @type {AudioBufferSourceNode | null} */
let waterfallSource = null;
/** @type {Voice[]} */
let birdVoices = [];
/**
 * Per-bird wander state (walker-style).
 * @type {Array<{
 *   x:number,z:number,y:number,speed:number,
 *   targetX:number,targetZ:number,targetY:number,
 *   pause:number,chirpNext:number,flapAcc:number,flapAlt:number,dragHold:number
 * }>}
 */
let birds = [];

const AMBI_BASE_ANGLES = [-2.4, -0.9, 0.9, 2.4]; // radians around listener

function birdCount() {
  return Math.max(1, Math.min(8, Number(els.birdCount?.value || 3)));
}
function maxBirdFlySpeed() {
  return Number(els.birdFly.value) / 10;
}

// --- buffers ---------------------------------------------------------------

function toMono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer;
  const out = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
  const dest = out.getChannelData(0);
  const n = buffer.numberOfChannels;
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < buffer.length; i++) dest[i] += ch[i] / n;
  }
  return out;
}

async function loadBuffer(id) {
  if (bufferCache.has(id)) return bufferCache.get(id);
  const url = SAMPLE_URLS[id];
  if (!url) throw new Error(`Unknown sample ${id}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}`);
  const ab = await res.arrayBuffer();
  const decoded = await ctx.decodeAudioData(ab.slice(0));
  const mono = toMono(decoded);
  bufferCache.set(id, mono);
  return mono;
}

// --- output graph ----------------------------------------------------------

function configureDestination(channelCount) {
  const dest = ctx.destination;
  deviceMax = dest.maxChannelCount || 2;
  const n = Math.min(channelCount, deviceMax);
  try {
    dest.channelCount = n;
    dest.channelCountMode = "explicit";
    dest.channelInterpretation = "discrete";
  } catch (err) {
    console.warn(err);
  }
  activeChannels = dest.channelCount;
  return activeChannels;
}

function teardownRoom() {
  for (const g of roomDiffuseGains) {
    try {
      g.disconnect();
    } catch {
      /* noop */
    }
  }
  roomDiffuseGains = [];
  for (const n of [...earlyDelays, ...earlyGains]) {
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
  }
  earlyDelays = [];
  earlyGains = [];
  for (const n of [roomWetGain, roomConvolver, roomInput]) {
    if (!n) continue;
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
  }
  roomWetGain = null;
  roomConvolver = null;
  roomInput = null;
}

function updateRoomStatsUI(metrics) {
  if (!els.roomStats) return;
  els.roomStats.textContent =
    `V=${metrics.V.toFixed(1)} m³ · S=${metrics.S.toFixed(1)} m² · ` +
    `Sabine RT60≈${metrics.rt60.toFixed(2)} s · abs=${metrics.abs.toFixed(2)}`;
}

/** Shared room bus: early reflections + Sabine-driven convolver IR → all speakers. */
function buildRoom(n) {
  teardownRoom();
  const metrics = computeRoomMetrics();
  roomInput = ctx.createGain();
  roomInput.gain.value = 1;

  roomConvolver = ctx.createConvolver();
  roomConvolver.normalize = true;
  roomConvolver.buffer = buildRoomIR(metrics.rt60);

  roomWetGain = ctx.createGain();
  roomWetGain.gain.value = els.roomOn.checked ? roomWetLevel() * 0.85 : 0;

  roomInput.connect(roomConvolver);
  roomConvolver.connect(roomWetGain);

  const omni = 1 / Math.sqrt(Math.max(1, n));
  roomDiffuseGains = [];
  for (let i = 0; i < n; i++) {
    const g = ctx.createGain();
    g.gain.value = omni;
    roomWetGain.connect(g);
    g.connect(merger, 0, i);
    roomDiffuseGains.push(g);
  }

  // Early room taps: directional, instantaneous (no DelayNode — no Doppler while moving)
  const halfW = metrics.w / 2;
  const halfD = metrics.d / 2;
  const earlyLevel = 0.14 * (1 - metrics.abs);
  const speakers = orbitSpeakers(LAYOUTS[els.layout.value], n, { skipCenter: true });
  // Arrival angles toward each room wall from the current listener seat
  const roomDirs = [
    { x: listener.x + halfW, z: listener.z }, // right
    { x: listener.x - halfW, z: listener.z }, // left
    { x: listener.x, z: listener.z + halfD }, // back
    { x: listener.x, z: listener.z - halfD }, // front
  ];

  for (let i = 0; i < roomDirs.length; i++) {
    const g = ctx.createGain();
    g.gain.value = els.roomOn.checked ? earlyLevel * (1 - i * 0.12) : 0;
    roomInput.connect(g);
    earlyGains.push(g);

    const scratch = new Float32Array(n);
    if (speakers.length && roomDirs[i]) {
      vbapGains(roomDirs[i].x, roomDirs[i].z, speakers, scratch);
    }
    for (let ch = 0; ch < n; ch++) {
      const w = scratch[ch] || (speakers.length ? 0 : omni);
      if (w < 0.04) continue;
      const cg = ctx.createGain();
      cg.gain.value = w;
      g.connect(cg);
      cg.connect(merger, 0, ch);
      earlyGains.push(cg);
    }
  }

  updateRoomStatsUI(metrics);
}

function refreshRoomFromUI() {
  if (!ctx || !merger || !audioReady) {
    updateLabels();
    return;
  }
  const metrics = computeRoomMetrics();
  updateRoomStatsUI(metrics);
  updateLabels();
  if (roomConvolver) {
    roomConvolver.buffer = buildRoomIR(metrics.rt60);
  }
  if (roomWetGain) {
    roomWetGain.gain.value = els.roomOn.checked ? roomWetLevel() * 0.85 : 0;
  }
  const earlyLevel = els.roomOn.checked ? 0.14 * (1 - metrics.abs) : 0;
  // First N earlyGains that are the delay outputs (we pushed delay gain then channel gains)
  // Simpler: scale all early delay root gains — stored as earlyDelays paired with first gains
  for (let i = 0; i < earlyDelays.length; i++) {
    // find gain immediately after delay in earlyGains — we pushed g after each delay
    // earlyGains structure: [g0, cg..., g1, cg..., ...] — fragile. Just refreshAcoustics wet sends.
  }
  refreshAcoustics();
  // Rebuild early levels properly when size/abs changes significantly
  if (activeChannels) {
    // light rebuild of room only
    const n = activeChannels;
    // disconnect early only and rebuild
    for (const node of [...earlyDelays, ...earlyGains]) {
      try {
        node.disconnect();
      } catch {
        /* noop */
      }
    }
    earlyDelays = [];
    earlyGains = [];
    const halfW = metrics.w / 2;
    const halfD = metrics.d / 2;
    const speakers = orbitSpeakers(LAYOUTS[els.layout.value], n, { skipCenter: true });
    const roomDirs = [
      { x: listener.x + halfW, z: listener.z },
      { x: listener.x - halfW, z: listener.z },
      { x: listener.x, z: listener.z + halfD },
      { x: listener.x, z: listener.z - halfD },
    ];
    const omni = 1 / Math.sqrt(n);
    for (let i = 0; i < roomDirs.length; i++) {
      const g = ctx.createGain();
      g.gain.value = earlyLevel * (1 - i * 0.12);
      roomInput.connect(g);
      earlyGains.push(g);
      const scratch = new Float32Array(n);
      if (speakers.length && roomDirs[i]) {
        vbapGains(roomDirs[i].x, roomDirs[i].z, speakers, scratch);
      }
      for (let ch = 0; ch < n; ch++) {
        const w = scratch[ch] || (speakers.length ? 0 : omni);
        if (w < 0.04) continue;
        const cg = ctx.createGain();
        cg.gain.value = w;
        g.connect(cg);
        cg.connect(merger, 0, ch);
        earlyGains.push(cg);
      }
    }
  }
}

function teardownVoices() {
  stopAmbiSources();
  stopWaterfall();
  for (const v of ambiVoices) v.detach();
  ambiVoices = [];
  if (walkVoice) {
    walkVoice.detach();
    walkVoice = null;
  }
  if (waterfallVoice) {
    waterfallVoice.detach();
    waterfallVoice = null;
  }
  for (const v of birdVoices) v.detach();
  birdVoices = [];
  birds = [];
  if (uiVoice) {
    uiVoice.detach();
    uiVoice = null;
  }
  teardownRoom();
  if (merger) {
    try {
      merger.disconnect();
    } catch {
      /* noop */
    }
    merger = null;
  }
}

function rebuildBus() {
  if (!ctx) return;
  teardownVoices();

  const layout = LAYOUTS[els.layout.value];
  const n = configureDestination(layout.channels);
  merger = ctx.createChannelMerger(n);
  merger.channelInterpretation = "discrete";
  merger.connect(ctx.destination);

  buildRoom(n);

  // 4 FOA bed voices around the listener
  ambiVoices = AMBI_BASE_ANGLES.map(() => new Voice("foa"));
  for (const v of ambiVoices) v.attach(n);

  walkVoice = new Voice("vbap");
  walkVoice.attach(n);

  waterfallVoice = new Voice(els.fallSpatial.value);
  waterfallVoice.attach(n);
  waterfallVoice.setPosition(waterfallMesh.position.x, waterfallMesh.position.z, {
    apply: false,
  });

  rebuildBirdAgents(n, { apply: false });

  uiVoice = new Voice("ui");
  uiVoice.attach(n);

  placeAmbiBeds(0, { apply: false });
  syncLevels({ apply: false });
  // One spat pass after the graph is fully wired
  refreshAcoustics();

  els.caps.textContent =
    `${layout.label} · ${n}ch · FOA bed + VBAP walker + fall + ${birds.length} birds + UI` +
    (n < layout.channels ? " — pick a surround sink, then Enable again" : "");

  rebuildSpeakerVisuals();
}

function randomBirdSpawn() {
  const p = randomClearPoint(1.6, 4.4);
  return {
    x: p.x,
    z: p.z,
    y: 0.7 + Math.random() * 1.1,
  };
}

function pickBirdTarget(b) {
  const p = randomClearPoint(1.4, 4.6);
  b.targetX = p.x;
  b.targetZ = p.z;
  b.targetY = 0.55 + Math.random() * 1.6;
  b.pause = 0;
}

function makeBirdAgent(seedIndex) {
  const p = randomBirdSpawn();
  const b = {
    x: p.x,
    z: p.z,
    y: p.y,
    speed: 0,
    targetX: p.x,
    targetZ: p.z,
    targetY: p.y,
    pause: 0.2 + Math.random() * 0.6,
    chirpNext: 0.2 + seedIndex * 0.25 + Math.random() * 0.8,
    flapAcc: 0,
    flapAlt: seedIndex,
    dragHold: 0,
  };
  pickBirdTarget(b);
  return b;
}

/**
 * Rebuild bird voices + meshes for current bird count.
 * @param {number} [channelCount]
 */
function rebuildBirdAgents(channelCount, { apply = true } = {}) {
  const n = channelCount ?? activeChannels ?? 2;
  for (const v of birdVoices) v.detach();
  birdVoices = [];

  const count = birdCount();
  // Preserve positions if shrinking/growing where possible
  const prev = birds.slice();
  birds = [];
  for (let i = 0; i < count; i++) {
    if (prev[i]) {
      birds.push(prev[i]);
    } else {
      birds.push(makeBirdAgent(i));
    }
  }

  for (let i = 0; i < count; i++) {
    const v = new Voice(els.birdSpatial.value);
    if (ctx && merger) v.attach(n);
    v.setPosition(birds[i].x, birds[i].z, { apply: false });
    birdVoices.push(v);
  }

  rebuildBirdMeshes();
  syncLevels({ apply });
  if (apply) refreshAcoustics();
}

function placeAmbiBeds(driftPhase, { apply = false } = {}) {
  const radius = 3.2;
  for (let i = 0; i < ambiVoices.length; i++) {
    const v = ambiVoices[i];
    if (!v) continue;
    const a = AMBI_BASE_ANGLES[i] + driftPhase;
    v.x = listener.x + Math.sin(a) * radius;
    v.z = listener.z - Math.cos(a) * radius;
    // Default: pose only — full spat is throttled in tick (per-frame spat stalls audio)
    if (apply) v.applySpatial();
  }
}

function syncLevels({ apply = true } = {}) {
  const ambi = els.ambiOn.checked ? volCurve(els.ambiVol.value) : 0;
  for (const v of ambiVoices) v.setLevel(ambi * 0.55, { apply });

  if (walkVoice) {
    walkVoice.setLevel(els.walkOn.checked ? volCurve(els.walkVol.value) : 0, { apply });
  }
  if (waterfallVoice) {
    waterfallVoice.setLevel(els.fallOn.checked ? volCurve(els.fallVol.value) : 0, {
      apply,
    });
  }
  const birdLvl = els.birdOn.checked ? volCurve(els.birdVol.value) : 0;
  for (const v of birdVoices) v.setLevel(birdLvl, { apply });

  if (uiVoice) uiVoice.setLevel(volCurve(els.uiVol.value), { apply });
  if (apply) bumpSpatSettle(8);
}

function stopWaterfall() {
  if (waterfallSource) {
    try {
      waterfallSource.stop();
      waterfallSource.disconnect();
    } catch {
      /* noop */
    }
    waterfallSource = null;
  }
}

async function startWaterfall() {
  stopWaterfall();
  if (!els.fallOn.checked || !waterfallVoice?.input || !sceneRunning) return;
  // Bust cache so a replaced asset (e.g. waterfall.wav) is picked up after refresh/swap
  const id = els.fallSound.value;
  bufferCache.delete(id);
  let buf;
  if (id === "waterfall") {
    try {
      buf = await loadBuffer("waterfall");
    } catch {
      buf = createWaterNoiseBuffer(8);
      bufferCache.set("waterfall", buf);
    }
  } else {
    buf = await loadBuffer(id);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  // Crossfade-ish: constant rate, no sweeps
  src.playbackRate.value = 1;
  src.connect(waterfallVoice.input);
  src.start();
  waterfallSource = src;
}

/** Steady multi-band water bed — no pitch motion (avoids "drill" loops). */
function createWaterNoiseBuffer(seconds = 8) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Paul Kellet pink
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  let brown = 0;
  // Simple one-pole filters for band layers
  let low = 0;
  let mid = 0;
  let hi = 0;
  const lpLow = Math.exp((-2 * Math.PI * 700) / ctx.sampleRate);
  const lpMid = Math.exp((-2 * Math.PI * 3200) / ctx.sampleRate);
  const hpMid = Math.exp((-2 * Math.PI * 400) / ctx.sampleRate);
  const hpHi = Math.exp((-2 * Math.PI * 4500) / ctx.sampleRate);

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;

    brown = (brown + 0.02 * white) / 1.02;
    const brownish = brown * 3.2;

    low = lpLow * low + (1 - lpLow) * brownish;
    const midIn = pink - (hpMid * mid + (1 - hpMid) * pink);
    mid = lpMid * mid + (1 - lpMid) * pink;
    hi = hpHi * hi + (1 - hpHi) * white;

    let s = low * 0.55 + mid * 0.38 + hi * 0.08 + midIn * 0.05;
    // Soft edges for seamless loop
    const fade = Math.min(i, length - 1 - i, ctx.sampleRate * 0.15) / (ctx.sampleRate * 0.15);
    s *= Math.min(1, fade);
    data[i] = Math.max(-1, Math.min(1, s * 0.7));
  }
  return buffer;
}

function birdChirpHz() {
  return Number(els.birdRate.value) / 100;
}

async function triggerBirdChirp(index) {
  if (!els.birdOn.checked || !sceneRunning) return;
  const voice = birdVoices[index];
  if (!voice) return;
  const buf = await loadBuffer(els.birdSound.value);
  const src = voice.play(buf, { loop: false });
  if (!src) return;
  src.playbackRate.value = 0.92 + Math.random() * 0.18;
  src.onended = () => {
    try {
      src.disconnect();
    } catch {
      /* noop */
    }
  };
}

async function triggerBirdFlap(index, speedRatio) {
  if (!els.birdOn.checked || !sceneRunning) return;
  const voice = birdVoices[index];
  if (!voice) return;
  // Alternate single wing beats (air slap), not magic SFX
  const id = birds[index].flapAlt % 2 === 0 ? "flap1" : "flap2";
  birds[index].flapAlt++;
  let buf;
  try {
    buf = await loadBuffer(id);
  } catch {
    buf = createFlapBuffer(speedRatio);
  }
  const src = voice.play(buf, { loop: false });
  if (!src) return;
  // Faster flight → slightly quicker / brighter flaps
  src.playbackRate.value = 0.92 + speedRatio * 0.28 + (Math.random() - 0.5) * 0.06;
  src.onended = () => {
    try {
      src.disconnect();
    } catch {
      /* noop */
    }
  };
}

/** Soft air-thump wing beat — low, pillow envelope (not snare wire / magic). */
function createFlapBuffer(brightness = 0.5) {
  const key = `synth:wingsoft:${brightness.toFixed(2)}`;
  if (bufferCache.has(key)) return bufferCache.get(key);
  const dur = 0.085;
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let lp = 0;
  const cut = 200 + brightness * 140;
  const a = Math.exp((-2 * Math.PI * cut) / ctx.sampleRate);
  for (let i = 0; i < length; i++) {
    const t = i / Math.max(1, length - 1);
    const env = Math.sin(Math.PI * t) ** 2.4;
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.03 * white) / 1.03;
    lp = a * lp + (1 - a) * brown;
    data[i] = Math.max(-1, Math.min(1, lp * env * 0.65));
  }
  bufferCache.set(key, buffer);
  return buffer;
}

function updateBirds(dt) {
  if (!els.birdOn.checked) {
    syncBirdMeshes();
    return;
  }

  const maxSpd = maxBirdFlySpeed();
  const chirpHz = birdChirpHz();

  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    if (b.dragHold > 0) {
      b.dragHold -= dt;
      b.speed = 0;
      if (birdVoices[i]) birdVoices[i].setPosition(b.x, b.z, { apply: false });
      // Still chirp while held/dragged
    } else if (sceneRunning) {
      if (b.pause > 0) {
        b.pause -= dt;
        b.speed = 0;
        // Ease down toward perch height while waiting
        b.y += (Math.min(b.y, 0.7) - b.y) * Math.min(1, dt * 2);
        if (b.pause <= 0) pickBirdTarget(b);
      } else {
        const dx = b.targetX - b.x;
        const dz = b.targetZ - b.z;
        const dy = b.targetY - b.y;
        const dist = Math.hypot(dx, dz, dy) || 1e-6;
        const slowR = Math.max(0.9, maxSpd * 0.75);
        const arriveR = 0.22;
        let desired = 0;
        if (dist > arriveR) {
          const t = Math.min(1, Math.max(0, (dist - arriveR) / (slowR - arriveR)));
          const eased = t * t * (3 - 2 * t);
          const floor = dist > slowR * 0.5 ? 0.3 : 0;
          desired = maxSpd * Math.max(floor, eased);
        }
        const accel = desired >= b.speed ? 3.4 : 5.0;
        const maxStep = accel * dt;
        b.speed += Math.max(-maxStep, Math.min(maxStep, desired - b.speed));

        const ux = dx / dist;
        const uz = dz / dist;
        const uy = dy / dist;
        const step = b.speed * dt;
        b.x += ux * step;
        b.z += uz * step;
        b.y += uy * step;

        // Wing beats by distance flown (~2 flaps per meter at cruise)
        b.flapAcc += step;
        const flapStride = 0.42 + Math.random() * 0.1;
        const speedRatio = Math.min(1, b.speed / Math.max(0.25, maxSpd));
        while (b.flapAcc >= flapStride) {
          b.flapAcc -= flapStride;
          if (b.speed > 0.25) triggerBirdFlap(i, speedRatio);
        }

        if (dist < 0.25 && b.speed < 0.2) {
          b.x = b.targetX;
          b.z = b.targetZ;
          b.y = b.targetY;
          b.speed = 0;
          b.pause = 0.4 + Math.random() * 1.2;
        }
      }

      if (birdVoices[i]) birdVoices[i].setPosition(b.x, b.z, { apply: false });
    }

    // Constant chirping whether perched or flying
    if (sceneRunning && els.birdOn.checked) {
      b.chirpNext -= dt;
      if (b.chirpNext <= 0) {
        triggerBirdChirp(i);
        const jitter = 0.55 + Math.random() * 0.95;
        b.chirpNext = jitter / Math.max(0.05, chirpHz);
      }
    }
  }

  syncBirdMeshes();
}

function syncWaterfallVisual() {
  const x = waterfallMesh.position.x;
  const z = waterfallMesh.position.z;
  if (waterfallVoice) waterfallVoice.setPosition(x, z, { apply: false });
  bumpSpatSettle(8);
}

function syncBirdMeshes() {
  for (let i = 0; i < birdMeshes.length; i++) {
    const m = birdMeshes[i];
    const b = birds[i];
    if (!b) continue;
    m.position.set(b.x, 0, b.z);
    const body = m.userData.birdBody;
    if (body) {
      body.position.y = b.y;
      // Bob wings / body a bit when flying
      const flying = b.speed > 0.2 && b.pause <= 0 && b.dragHold <= 0;
      if (flying) {
        body.position.y += Math.sin(performance.now() * 0.04 + i) * 0.06;
        body.scale.setScalar(1 + 0.08 * Math.sin(performance.now() * 0.05 + i));
      } else {
        body.scale.setScalar(1);
      }
    }
  }
}

function stopAmbiSources() {
  for (const s of ambiSources) {
    try {
      s.stop();
      s.disconnect();
    } catch {
      /* noop */
    }
  }
  ambiSources = [];
}

async function startAmbi() {
  stopAmbiSources();
  if (!els.ambiOn.checked || !ambiVoices.length) return;
  const buf = await loadBuffer("rainforest");
  for (let i = 0; i < ambiVoices.length; i++) {
    const voice = ambiVoices[i];
    if (!voice.input) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.97 + i * 0.015;
    src.connect(voice.input);
    const offset = (buf.duration * i) / ambiVoices.length;
    src.start(0, offset % Math.max(buf.duration, 0.01));
    ambiSources.push(src);
  }
}

// --- navigation (listener click-to-go + walker wander around walls) --------

/** Agent radius for wall clearance. LOS uses a slightly fatter margin. */
const NAV_RADIUS = 0.42;
const NAV_LOS = 0.5;

const walk = {
  x: -2.2,
  z: -1.6,
  vx: 0,
  vz: 0,
  speed: 0,
  targetX: 2.0,
  targetZ: -1.2,
  goalX: 2.0,
  goalZ: -1.2,
  /** @type {{ x: number, z: number }[]} remaining waypoints after current target */
  path: [],
  strideAcc: 0,
  footAlt: 0,
  pause: 0,
  arriving: false,
};

/** Listener auto-move (tap ground). Drag cancels. */
const listenNav = {
  active: false,
  speed: 0,
  targetX: 0,
  targetZ: 0,
  goalX: 0,
  goalZ: 0,
  /** @type {{ x: number, z: number }[]} */
  path: [],
  stuckFrames: 0,
  /** Desired facing while navigating (smoothly chased). */
  faceYaw: 0,
  audioAccum: 0,
  lastRepathAt: 0,
};

function maxWalkSpeed() {
  return Number(els.walkSpeed.value) / 10;
}
function strideLen() {
  return Number(els.walkStride.value) / 100;
}
function wanderRadius() {
  return Number(els.walkRadius.value) / 10;
}

function expandOccluder(o, m) {
  return { x0: o.x0 - m, z0: o.z0 - m, x1: o.x1 + m, z1: o.z1 + m };
}

/** Push a point out of walls (expanded by margin). Prefers diagonal escape near corners. */
function nearestClearPoint(x, z, margin = NAV_RADIUS) {
  let px = Math.max(-5.5, Math.min(5.5, x));
  let pz = Math.max(-5.5, Math.min(5.5, z));
  for (let iter = 0; iter < 12; iter++) {
    let hit = null;
    for (const o of occluders) {
      const e = expandOccluder(o, margin);
      if (pointInRect(px, pz, e)) {
        hit = e;
        break;
      }
    }
    if (!hit) return { x: px, z: pz };
    const dl = px - hit.x0;
    const dr = hit.x1 - px;
    const db = pz - hit.z0;
    const dt = hit.z1 - pz;
    const pad = 0.06;
    // Near a corner (two small depths) → push out on both axes
    const cornerish = (dl < 0.25 || dr < 0.25) && (db < 0.25 || dt < 0.25);
    if (cornerish) {
      px += dl < dr ? -(dl + pad) : dr + pad;
      pz += db < dt ? -(db + pad) : dt + pad;
    } else {
      const m = Math.min(dl, dr, db, dt);
      if (m === dl) px = hit.x0 - pad;
      else if (m === dr) px = hit.x1 + pad;
      else if (m === db) pz = hit.z0 - pad;
      else pz = hit.z1 + pad;
    }
    px = Math.max(-5.5, Math.min(5.5, px));
    pz = Math.max(-5.5, Math.min(5.5, pz));
  }
  return { x: px, z: pz };
}

/** Fast segment vs AABB (XZ) — avoids the slow sample loop for pathfinding. */
function segmentHitsAabb(ax, az, bx, bz, o) {
  // Liang–Barsky style clip in 2D
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const checks = [
    [-dx, ax - o.x0],
    [dx, o.x1 - ax],
    [-dz, az - o.z0],
    [dz, o.z1 - az],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t1 >= t0;
}

function navLosClear(ax, az, bx, bz, margin = NAV_LOS) {
  // Degenerate segment: treat as a point sample
  if (Math.hypot(bx - ax, bz - az) < 1e-9) {
    for (const o of occluders) {
      if (pointInRect(ax, az, expandOccluder(o, margin))) return false;
    }
    return true;
  }
  for (const o of occluders) {
    if (segmentHitsAabb(ax, az, bx, bz, expandOccluder(o, margin))) return false;
  }
  return true;
}

/** Waypoints offset past corners/edges so paths don't graze AABB corners. */
function navObstacleNodes() {
  const nodes = [];
  const m = NAV_RADIUS + 0.1;
  const bump = 0.22;
  for (const o of occluders) {
    const e = expandOccluder(o, m);
    const corners = [
      [e.x0 - bump, e.z0 - bump],
      [e.x1 + bump, e.z0 - bump],
      [e.x1 + bump, e.z1 + bump],
      [e.x0 - bump, e.z1 + bump],
    ];
    const mids = [
      [(e.x0 + e.x1) / 2, e.z0 - bump],
      [(e.x0 + e.x1) / 2, e.z1 + bump],
      [e.x0 - bump, (e.z0 + e.z1) / 2],
      [e.x1 + bump, (e.z0 + e.z1) / 2],
    ];
    for (const [x, z] of [...corners, ...mids]) {
      const c = nearestClearPoint(x, z, NAV_RADIUS);
      // Must stay clearly outside the LOS hull
      if (navLosClear(c.x, c.z, c.x, c.z, NAV_RADIUS) && !isInsideWall(c.x, c.z, NAV_RADIUS)) {
        nodes.push(c);
      }
    }
  }
  return nodes;
}

/** Shortest corner-waypoint path. Returns waypoints including goal (not start). */
function findNavPath(sx, sz, gx, gz) {
  const start = nearestClearPoint(sx, sz);
  const goal = nearestClearPoint(gx, gz);
  if (navLosClear(start.x, start.z, goal.x, goal.z)) {
    return [{ x: goal.x, z: goal.z }];
  }

  const nodes = [{ x: start.x, z: start.z }, { x: goal.x, z: goal.z }, ...navObstacleNodes()];
  const n = nodes.length;
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const used = Array(n).fill(false);
  dist[0] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!used[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0 || best === Infinity) break;
    used[u] = true;
    if (u === 1) break;
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      if (!navLosClear(nodes[u].x, nodes[u].z, nodes[v].x, nodes[v].z)) continue;
      const w = Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z);
      const nd = dist[u] + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
      }
    }
  }

  if (dist[1] === Infinity) return [{ x: goal.x, z: goal.z }];

  const chain = [];
  const seen = new Set();
  for (let cur = 1; cur !== 0 && cur >= 0; cur = prev[cur]) {
    if (seen.has(cur) || cur >= n) break;
    seen.add(cur);
    const node = nodes[cur];
    if (node) chain.push(node);
    if (chain.length > n + 2) break;
  }
  chain.reverse();
  // Drop consecutive near-duplicates (keeps path stable for arrive radius)
  const cleaned = [];
  for (const p of chain) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.05) cleaned.push(p);
  }
  return cleaned.length ? cleaned : [{ x: goal.x, z: goal.z }];
}

/** Axis slide + diagonal corner escape. Returns distance moved. */
function navStep(agent, stepX, stepZ, clear = NAV_RADIUS) {
  const nx = agent.x + stepX;
  const nz = agent.z + stepZ;
  if (!isInsideWall(nx, nz, clear)) {
    agent.x = nx;
    agent.z = nz;
    return Math.hypot(stepX, stepZ);
  }
  if (!isInsideWall(nx, agent.z, clear)) {
    agent.x = nx;
    return Math.abs(stepX);
  }
  if (!isInsideWall(agent.x, nz, clear)) {
    agent.z = nz;
    return Math.abs(stepZ);
  }
  // Corner wedge — eject then try a short diagonal away from the obstacle
  const freed = nearestClearPoint(agent.x, agent.z, clear + 0.08);
  agent.x = freed.x;
  agent.z = freed.z;
  return 0;
}

function setWalkDestination(x, z) {
  const goal = nearestClearPoint(x, z);
  walk.goalX = goal.x;
  walk.goalZ = goal.z;
  walk.path = findNavPath(walk.x, walk.z, goal.x, goal.z);
  const first = walk.path.shift() || goal;
  walk.targetX = first.x;
  walk.targetZ = first.z;
  walk.arriving = false;
  walk.pause = 0;
  syncWalkerVisuals();
}

function pickWalkTarget() {
  const R = wanderRadius();
  const minR = Math.max(1.1, R * 0.35);
  let chosen = null;
  for (let tries = 0; tries < 30; tries++) {
    const p = randomClearPoint(minR, R);
    if (Math.hypot(p.x - walk.x, p.z - walk.z) >= R * 0.3) {
      chosen = p;
      break;
    }
  }
  if (!chosen) chosen = randomClearPoint(minR, R);
  setWalkDestination(chosen.x, chosen.z);
}

function resetWalker() {
  const R = wanderRadius();
  const p = randomClearPoint(R * 0.45, R * 0.85);
  walk.x = p.x;
  walk.z = p.z;
  walk.vx = 0;
  walk.vz = 0;
  walk.speed = 0;
  walk.strideAcc = strideLen() * 0.5;
  walk.footAlt = 0;
  walk.pause = 0.15;
  walk.path = [];
  pickWalkTarget();
  syncWalkerVisuals();
}

function syncWalkerVisuals() {
  walkerMesh.position.set(walk.x, 0.15, walk.z);
  targetMesh.position.set(walk.goalX, 0.04, walk.goalZ);
  if (walkVoice) walkVoice.setPosition(walk.x, walk.z, { apply: false });
  updatePathLine();
}

function cancelListenerNav({ stopFacing = true } = {}) {
  listenNav.active = false;
  listenNav.speed = 0;
  listenNav.path = [];
  listenNav.stuckFrames = 0;
  listenNav.audioAccum = 0;
  if (stopFacing) listenNav.faceYaw = listener.yaw;
  updateListenerPathLine();
}

function commandListenerTo(x, z) {
  const goal = nearestClearPoint(x, z);
  let path;
  try {
    path = findNavPath(listener.x, listener.z, goal.x, goal.z);
  } catch (err) {
    console.warn("findNavPath failed", err);
    path = [{ x: goal.x, z: goal.z }];
  }
  if (!Array.isArray(path) || !path.length) path = [{ x: goal.x, z: goal.z }];

  listenNav.goalX = goal.x;
  listenNav.goalZ = goal.z;
  listenNav.path = path;
  const first = listenNav.path.shift() || goal;
  listenNav.targetX = first.x;
  listenNav.targetZ = first.z;
  listenNav.active = true;
  listenNav.speed = 0;
  listenNav.stuckFrames = 0;
  listenNav.audioAccum = 0.08; // spat on next nav tick, not synchronously in the click handler
  listenNav.lastRepathAt = performance.now();
  const fdx = first.x - listener.x;
  const fdz = first.z - listener.z;
  if (fdx * fdx + fdz * fdz > 1e-6) {
    listenNav.faceYaw = yawFromDir(fdx, fdz);
  }
  updateListenerPathLine();
  setStatus(`Listener → (${goal.x.toFixed(1)}, ${goal.z.toFixed(1)})`);
}

function repathListenerNav() {
  if (!listenNav.active) return;
  const now = performance.now();
  if (now - listenNav.lastRepathAt < 320) return;
  listenNav.lastRepathAt = now;
  listenNav.path = findNavPath(listener.x, listener.z, listenNav.goalX, listenNav.goalZ);
  const first = listenNav.path.shift() || {
    x: listenNav.goalX,
    z: listenNav.goalZ,
  };
  listenNav.targetX = first.x;
  listenNav.targetZ = first.z;
  listenNav.stuckFrames = 0;
  listenNav.faceYaw = yawFromDir(first.x - listener.x, first.z - listener.z);
  updateListenerPathLine();
}

async function triggerFootstep(speedRatio) {
  if (!walkVoice || !els.walkOn.checked || !sceneRunning) return;
  const id = walk.footAlt % 2 === 0 ? "foot1" : "foot2";
  walk.footAlt++;
  const buf = await loadBuffer(id);
  const src = walkVoice.play(buf, { loop: false });
  if (!src) return;
  // Quieter / darker when creeping in
  const rate = 0.92 + speedRatio * 0.14;
  src.playbackRate.value = rate;
  src.onended = () => {
    try {
      src.disconnect();
    } catch {
      /* noop */
    }
  };
}

/**
 * Desired speed from distance-to-target:
 * - ramp up after leaving a point (handled by accel clamp)
 * - ease down inside slowRadius so they bleed speed into the approach
 */
function desiredSpeedForDistance(dist, maxSpd) {
  const slowRadius = Math.max(0.85, maxSpd * 0.9); // start braking ~1s of travel out
  const arriveRadius = 0.18;
  if (dist <= arriveRadius) return 0;
  // Smoothstep ease-out as target nears
  const t = Math.min(1, Math.max(0, (dist - arriveRadius) / (slowRadius - arriveRadius)));
  const eased = t * t * (3 - 2 * t); // smoothstep
  // Never crawl forever mid-path — floor at ~25% until deep into approach
  const floor = dist > slowRadius * 0.55 ? 0.35 : 0.0;
  return maxSpd * Math.max(floor, eased);
}

function updateWalker(dt) {
  if (!els.walkOn.checked) return;

  if (walk.pause > 0) {
    walk.pause -= dt;
    walk.speed = 0;
    walk.vx = 0;
    walk.vz = 0;
    syncWalkerVisuals();
    if (walk.pause <= 0) pickWalkTarget();
    return;
  }

  const dx = walk.targetX - walk.x;
  const dz = walk.targetZ - walk.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const maxSpd = maxWalkSpeed();
  const toGoal = Math.hypot(walk.goalX - walk.x, walk.goalZ - walk.z);
  const brakingDist = walk.path.length ? Math.max(dist, 1.2) : toGoal;
  const desired = desiredSpeedForDistance(brakingDist, maxSpd);

  const accel = desired >= walk.speed ? 2.8 : 4.2;
  const deltaV = desired - walk.speed;
  const maxStep = accel * dt;
  walk.speed += Math.max(-maxStep, Math.min(maxStep, deltaV));

  const ux = dx / dist;
  const uz = dz / dist;
  walk.vx = ux * walk.speed;
  walk.vz = uz * walk.speed;

  const moved = navStep(walk, walk.vx * dt, walk.vz * dt, NAV_RADIUS * 0.9);
  if (moved < 1e-5 && walk.speed > 0.05) {
    setWalkDestination(walk.goalX, walk.goalZ);
  }

  walk.strideAcc += moved;
  const stride = strideLen() * (0.92 + Math.random() * 0.08);
  const speedRatio = Math.min(1, walk.speed / Math.max(0.2, maxSpd));
  while (walk.strideAcc >= stride) {
    walk.strideAcc -= stride;
    if (walk.speed > 0.12) triggerFootstep(speedRatio);
  }

  // Intermediate waypoints: cut early so we don't stop on corners
  const arriveR = walk.path.length ? 0.38 : 0.2;
  if (dist < arriveR) {
    if (walk.path.length) {
      const next = walk.path.shift();
      walk.targetX = next.x;
      walk.targetZ = next.z;
    } else if (walk.speed < 0.18) {
      walk.x = walk.targetX;
      walk.z = walk.targetZ;
      walk.speed = 0;
      walk.pause = 0.25 + Math.random() * 0.55;
      walk.arriving = true;
    }
  }

  syncWalkerVisuals();
}

async function playUi(which) {
  if (!uiVoice || !audioReady) return;
  const map = { click: "uiClick", ok: "uiOk", pop: "uiPop" };
  const buf = await loadBuffer(map[which]);
  const src = uiVoice.play(buf, { loop: false });
  if (src) {
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        /* noop */
      }
    };
  }
}

// --- three.js --------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x0f171f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0f171f, 8, 22);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 4.2, 5.5);

const viewControls = new OrbitControls(camera, canvas);
viewControls.target.set(0, 0.2, 0);
viewControls.enableDamping = true;
viewControls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xb8d4e8, 0x1a2330, 1.1));
const key = new THREE.DirectionalLight(0xfff2e0, 1.25);
key.position.set(4, 8, 2);
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(8, 64),
  new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.92 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(14, 28, 0x2a3b4a, 0x1a2530));

const listenerMesh = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.22, 0.55, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0xd7e3ec, roughness: 0.35 })
);
body.position.y = 0.55;
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.1, 0.28, 10),
  new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xcbd5e1, emissiveIntensity: 0.35 })
);
// Apex along local −Z (front); +π/2 pointed the tip into the skull
nose.rotation.x = -Math.PI / 2;
nose.position.set(0, 0.7, -0.28);
// Front/rear ground fans (after Rx−90°: θ=0..π → right/front/left = front half)
const frontFan = new THREE.Mesh(
  new THREE.CircleGeometry(2.6, 48, 0, Math.PI),
  new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
frontFan.rotation.x = -Math.PI / 2;
frontFan.position.y = 0.025;
// Visual only — don't steal pointer drags from the floor discs
frontFan.raycast = () => {};
const rearFan = new THREE.Mesh(
  new THREE.CircleGeometry(2.6, 48, Math.PI, Math.PI),
  new THREE.MeshBasicMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
rearFan.rotation.x = -Math.PI / 2;
rearFan.position.y = 0.02;
rearFan.raycast = () => {};
listenerMesh.add(body, nose, frontFan, rearFan);
body.userData.dragId = "listener";
nose.userData.dragId = "listener";
listenerMesh.userData.dragId = "listener";
listenerMesh.userData.frontFan = frontFan;
listenerMesh.userData.rearFan = rearFan;
scene.add(listenerMesh);

/** Dim / cool meshes when they sit behind the listener. */
function tintSourceBehind(root, worldX, worldZ) {
  if (!root) return;
  const behind = els.frontBack?.checked ? behindAmount(worldX, worldZ) : 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material || o === frontFan || o === rearFan) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m?.color) continue;
      if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
      m.color.copy(m.userData.baseColor).lerp(new THREE.Color(0x475569), 0.35 * behind);
      if ("emissiveIntensity" in m) {
        if (m.userData.baseEmissive == null) m.userData.baseEmissive = m.emissiveIntensity;
        m.emissiveIntensity = m.userData.baseEmissive * (1 - 0.45 * behind);
      }
      if (m.transparent && "opacity" in m) {
        if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity;
        m.opacity = m.userData.baseOpacity * (1 - 0.2 * behind);
      }
    }
  });
}

function syncListenerMesh() {
  listenerMesh.position.set(listener.x, 0, listener.z);
  listenerMesh.rotation.y = listener.yaw;
}

/** Listener-move audio: pose ambi; spat is throttled in tick. */
function refreshListenerAudio({ settle = true } = {}) {
  // Speakers are head-locked (children of listenerMesh) — no re-aim needed
  placeAmbiBeds(ambiPhase, { apply: false });
  for (let i = 0; i < ambiMeshes.length; i++) {
    const v = ambiVoices[i];
    if (v) ambiMeshes[i].position.set(v.x, 1.1, v.z);
  }
  if (settle) {
    refreshAcoustics();
    bumpSpatSettle(24);
  } else {
    // Keep spat warm while walking/turning; tick runs ~28 Hz until settle drains
    bumpSpatSettle(6);
  }
}

function applyListenerPose(x, z, { settle = true, audio = true } = {}) {
  listener.x = Math.max(-5.5, Math.min(5.5, x));
  listener.z = Math.max(-5.5, Math.min(5.5, z));
  syncListenerMesh();
  if (audio) refreshListenerAudio({ settle });
}

function setListenerPosition(x, z) {
  cancelListenerNav();
  applyListenerPose(x, z, { settle: true, audio: true });
}

function updateListenerNav(dt) {
  if (!listenNav.active) {
    // Finish any in-progress turn after cancel/arrive
    if (Math.abs(shortestAngleDelta(listener.yaw, listenNav.faceYaw)) > 0.01) {
      smoothListenerYaw(dt, listenNav.faceYaw, 2.2);
      syncListenerMesh();
      listenNav.audioAccum += dt;
      if (listenNav.audioAccum >= 0.08) {
        listenNav.audioAccum = 0;
        refreshListenerAudio({ settle: false });
      }
    }
    return;
  }

  const dx = listenNav.targetX - listener.x;
  const dz = listenNav.targetZ - listener.z;
  const dist = Math.hypot(dx, dz) || 1e-6;

  const maxSpd = 2.4;
  const toGoal = Math.hypot(listenNav.goalX - listener.x, listenNav.goalZ - listener.z);
  const brakingDist = listenNav.path.length ? Math.max(dist, 1.4) : toGoal;
  const desired = desiredSpeedForDistance(brakingDist, maxSpd);

  const accel = desired >= listenNav.speed ? 3.2 : 5.0;
  listenNav.speed += Math.max(-accel * dt, Math.min(accel * dt, desired - listenNav.speed));

  // No collision — path already skirts walls; move straight along waypoints
  const step = Math.min(dist, listenNav.speed * dt);
  listener.x = Math.max(-5.5, Math.min(5.5, listener.x + (dx / dist) * step));
  listener.z = Math.max(-5.5, Math.min(5.5, listener.z + (dz / dist) * step));

  if (dist > 0.05) listenNav.faceYaw = yawFromDir(dx, dz);
  smoothListenerYaw(dt, listenNav.faceYaw, 3.0);
  syncListenerMesh();
  updateListenerPathLine();

  listenNav.audioAccum += dt;
  if (listenNav.audioAccum >= 0.08) {
    listenNav.audioAccum = 0;
    refreshListenerAudio({ settle: false });
  }

  const arriveR = listenNav.path.length ? 0.4 : 0.18;
  if (dist < arriveR) {
    if (listenNav.path.length) {
      const next = listenNav.path.shift();
      listenNav.targetX = next.x;
      listenNav.targetZ = next.z;
      listenNav.faceYaw = yawFromDir(next.x - listener.x, next.z - listener.z);
    } else if (listenNav.speed < 0.2) {
      applyListenerPose(listenNav.goalX, listenNav.goalZ, { settle: true, audio: true });
      // Keep faceYaw so the last bit of turn eases out after arrive
      cancelListenerNav({ stopFacing: false });
      setStatus("Listener arrived");
      if (audioReady) refreshRoomFromUI();
    }
  }
}

const walkerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 20, 14),
  new THREE.MeshStandardMaterial({
    color: 0xe8590c,
    emissive: 0xc2410c,
    emissiveIntensity: 0.85,
  })
);
scene.add(walkerMesh);

const targetMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.18, 0.28, 32),
  new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  })
);
targetMesh.rotation.x = -Math.PI / 2;
scene.add(targetMesh);

const ambiMeshes = AMBI_BASE_ANGLES.map(() => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      emissive: 0x0f766e,
      emissiveIntensity: 0.7,
    })
  );
  scene.add(m);
  return m;
});

const pathLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xe8590c, transparent: true, opacity: 0.55 })
);
scene.add(pathLine);

const listenerPathLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(0, 0.08, -1),
  ]),
  new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7 })
);
listenerPathLine.visible = false;
scene.add(listenerPathLine);

const waterfallMesh = new THREE.Group();
const fallColumn = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.32, 1.1, 16),
  new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
  })
);
fallColumn.position.y = 0.55;
const fallPool = new THREE.Mesh(
  new THREE.CircleGeometry(0.45, 24),
  new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2, metalness: 0.1 })
);
fallPool.rotation.x = -Math.PI / 2;
fallPool.position.y = 0.02;
waterfallMesh.add(fallColumn, fallPool);
waterfallMesh.position.set(-0.5, 0, -3.4);
waterfallMesh.userData.dragId = "waterfall";
scene.add(waterfallMesh);

/** @type {THREE.Group[]} */
let birdMeshes = [];
/** @type {THREE.Object3D[]} */
let draggables = [];

function rebuildBirdMeshes() {
  for (const m of birdMeshes) {
    scene.remove(m);
    m.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((mat) => mat.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  birdMeshes = [];
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4a32 })
    );
    post.position.y = 0.18;
    const bird = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.65,
      })
    );
    bird.position.y = b?.y ?? 0.7;
    g.add(post, bird);
    g.position.set(b?.x ?? 0, 0, b?.z ?? 0);
    g.userData.dragId = `bird-${i}`;
    g.userData.birdBody = bird;
    scene.add(g);
    birdMeshes.push(g);
  }
  refreshDraggables();
  syncBirdMeshes();
}

function refreshDraggables() {
  draggables = [listenerMesh, waterfallMesh, ...birdMeshes, ...wallGroups];
}

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundHit = new THREE.Vector3();
/** @type {THREE.Object3D | null} */
let dragTarget = null;

/** Head-locked speaker cabinets (must match VBAP/FOA channel angles). */
const speakerGroup = new THREE.Group();
listenerMesh.add(speakerGroup);

/** Room footprint stays world-fixed. */
const roomGroup = new THREE.Group();
scene.add(roomGroup);

const vizGroup = new THREE.Group();
scene.add(vizGroup);

/** Head-locked speaker energy rings — parented so they track the nose. */
const vizRingGroup = new THREE.Group();
listenerMesh.add(vizRingGroup);

/** @type {THREE.Line[]} */
let vizDirectLines = [];
/** @type {THREE.Line[]} */
let vizReflLines = [];
/** @type {THREE.Mesh[]} */
let vizImageDots = [];
/** @type {THREE.Mesh[]} */
let vizSpeakerRings = [];
/** @type {HTMLElement[]} */
let vizLabels = [];
/** @type {THREE.Mesh | null} */
let vizWetHalo = null;
const vizLabelLayer = document.getElementById("viz-labels");
const _labelNdc = new THREE.Vector3();

function makeLine(color, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const mat = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.12,
        gapSize: 0.08,
        transparent: true,
        opacity: 0.75,
      })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  vizGroup.add(line);
  return line;
}

function makeDebugLabel() {
  const el = document.createElement("div");
  el.className = "viz-label";
  vizLabelLayer?.appendChild(el);
  return el;
}

function hideAllDebugLabels() {
  for (const el of vizLabels) el.classList.remove("on");
  if (vizLabelLayer) vizLabelLayer.style.display = "none";
}

/** Project world point to overlay; returns false if behind camera / offscreen. */
function setDebugLabel(el, text, x, y, z, tone = "dry") {
  if (!el || !vizLabelLayer || !camera) return;
  _labelNdc.set(x, y, z);
  _labelNdc.project(camera);
  if (_labelNdc.z < -1 || _labelNdc.z > 1) {
    el.classList.remove("on");
    return;
  }
  const nx = _labelNdc.x;
  const ny = _labelNdc.y;
  // Keep a margin so chips aren't clipped at the viewport edge
  if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) {
    el.classList.remove("on");
    return;
  }
  const px = (nx * 0.5 + 0.5) * vizLabelLayer.clientWidth;
  const py = (-ny * 0.5 + 0.5) * vizLabelLayer.clientHeight;
  el.textContent = text;
  el.className = `viz-label on tone-${tone}`;
  el.style.transform = `translate(calc(${px}px - 50%), calc(${py}px - 100%))`;
}

function pct01(v) {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function ensureVizPool(directCount, reflCount, ringCount, labelCount) {
  // Hard caps — never grow unboundedly if counts go weird
  const maxDirect = Math.min(32, Math.max(0, directCount | 0));
  const maxRefl = Math.min(64, Math.max(0, reflCount | 0));
  const maxRings = Math.min(24, Math.max(0, ringCount | 0));
  const maxLabels = Math.min(96, Math.max(0, labelCount | 0));
  while (vizDirectLines.length < maxDirect) {
    vizDirectLines.push(makeLine(0x4ade80, false));
  }
  while (vizReflLines.length < maxRefl) {
    vizReflLines.push(makeLine(0x22d3ee, true));
  }
  while (vizImageDots.length < maxRefl) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })
    );
    dot.visible = false;
    vizGroup.add(dot);
    vizImageDots.push(dot);
  }
  while (vizSpeakerRings.length < maxRings) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.28, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    vizRingGroup.add(ring);
    vizSpeakerRings.push(ring);
  }
  while (vizLabels.length < maxLabels) {
    vizLabels.push(makeDebugLabel());
  }
  if (!vizWetHalo) {
    vizWetHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.55, 32),
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      })
    );
    vizWetHalo.rotation.x = -Math.PI / 2;
    vizWetHalo.position.y = 0.04;
    vizGroup.add(vizWetHalo);
  }
}

function setLineEndpoints(line, ax, ay, az, bx, by, bz) {
  const pos = line.geometry.attributes.position;
  pos.setXYZ(0, ax, ay, az);
  pos.setXYZ(1, bx, by, bz);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  if (line.material.isLineDashedMaterial) {
    line.computeLineDistances();
  }
}

function occColor(occ) {
  // green → amber → orange → red (continuous)
  if (occ < 0.12) return 0x4ade80;
  if (occ < 0.35) return 0xfbbf24;
  if (occ < 0.65) return 0xfb923c;
  return 0xf87171;
}

/**
 * Bounce point on the wall face (from image-source hit).
 */
function bouncePoint(sx, sz, img) {
  if (img.bx != null && img.bz != null) return { x: img.bx, z: img.bz };
  return { x: (sx + img.x) * 0.5, z: (sz + img.z) * 0.5 };
}

function collectVizSources() {
  const focus = els.vizFocus?.value || "waterfall";
  /** @type {{ voice: Voice, x: number, z: number, y: number, label: string }[]} */
  const list = [];

  const push = (voice, x, z, y, label, key) => {
    if (!voice) return;
    if (focus !== "all" && focus !== key) return;
    list.push({ voice, x, z, y, label });
  };

  push(waterfallVoice, waterfallMesh.position.x, waterfallMesh.position.z, 0.7, "fall", "waterfall");
  push(walkVoice, walk.x, walk.z, 0.2, "walk", "walker");
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    push(birdVoices[i], b.x, b.z, b.y, `bird${i}`, `bird-${i}`);
  }
  return list;
}

function refreshVizFocusOptions() {
  if (!els.vizFocus) return;
  const cur = els.vizFocus.value;
  els.vizFocus.innerHTML = "";
  const opts = [
    ["waterfall", "Waterfall"],
    ["walker", "Walker"],
    ...birds.map((_, i) => [`bird-${i}`, `Bird ${i + 1}`]),
    ["all", "All sources"],
  ];
  for (const [v, label] of opts) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    els.vizFocus.appendChild(o);
  }
  const values = opts.map((o) => o[0]);
  els.vizFocus.value = values.includes(cur) ? cur : "waterfall";
}

function updateAcousticsViz() {
  if (!els.vizOn?.checked) {
    vizGroup.visible = false;
    hideAllDebugLabels();
    return;
  }
  vizGroup.visible = true;
  if (vizLabelLayer) vizLabelLayer.style.display = "block";

  const sources = collectVizSources();
  const maxRefl = sources.reduce((n, s) => n + (s.voice.lastImages?.length || 0), 0);
  const layout = LAYOUTS[els.layout.value];
  const speakers = orbitSpeakers(layout, 16);
  const labelNeed = sources.length + maxRefl + speakers.length + 2;
  ensureVizPool(
    Math.max(1, sources.length),
    Math.max(16, maxRefl * 2 + 4),
    Math.max(8, speakers.length),
    labelNeed
  );

  // Hide all first
  for (const l of vizDirectLines) l.visible = false;
  for (const l of vizReflLines) l.visible = false;
  for (const d of vizImageDots) d.visible = false;
  for (const r of vizSpeakerRings) r.visible = false;
  for (const lab of vizLabels) lab.classList.remove("on");

  let reflIdx = 0;
  let labelIdx = 0;
  let energy = new Float32Array(16);
  let dryEnergy = new Float32Array(16);
  let reflEnergy = new Float32Array(16);
  let wetSum = 0;

  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    const v = s.voice;
    const line = vizDirectLines[si];
    if (!line || !v) continue;
    line.visible = true;
    // Occlusion tint, shifted cooler when the source is behind the listener
    const behind = v.lastBehind || 0;
    const occ = v.lastOcc || 0;
    const base = occColor(occ);
    line.material.color.setHex(base);
    if (behind > 0.05) {
      line.material.color.lerp(new THREE.Color(0x64748b), Math.min(0.85, behind));
    }
    setLineEndpoints(line, listener.x, 0.9, listener.z, s.x, s.y, s.z);

    const drySum = v.lastDrySum || 0;
    const reflSum = v.lastReflSum || 0;
    const wet = v.lastWet || 0;
    const midX = (listener.x + s.x) * 0.5;
    const midZ = (listener.z + s.z) * 0.5;
    const midY = 0.95 + s.y * 0.25;
    const directText = `${s.label} · dry ${pct01(v.lastDryMul ?? 1)} · occ ${pct01(occ)} · refl ${reflSum.toFixed(2)} · wet ${wet.toFixed(2)}`;
    if (labelIdx < vizLabels.length) {
      setDebugLabel(
        vizLabels[labelIdx++],
        directText,
        midX,
        midY,
        midZ,
        occ > 0.55 ? "occ" : "dry"
      );
    }

    const images = v.lastImages || [];
    for (const img of images) {
      if (reflIdx + 1 >= vizReflLines.length) break;
      const bounce = bouncePoint(s.x, s.z, img);
      const rl = vizReflLines[reflIdx];
      rl.visible = true;
      rl.material.color.setHex(0x22d3ee);
      // Source → wall hit
      setLineEndpoints(rl, s.x, s.y * 0.85, s.z, bounce.x, 1.0, bounce.z);

      const rl2 = vizReflLines[reflIdx + 1];
      rl2.visible = true;
      rl2.material.color.setHex(0x67e8f9);
      // Wall hit → listener
      setLineEndpoints(rl2, bounce.x, 1.0, bounce.z, listener.x, 0.9, listener.z);

      const dot = vizImageDots[Math.floor(reflIdx / 2)];
      if (dot) {
        dot.visible = true;
        // Dot sits on the wall bounce point
        dot.position.set(bounce.x, 1.05, bounce.z);
        const scale = 0.85 + Math.min(1.0, (img.rfl || 0.3) * 1.5);
        dot.scale.setScalar(scale);
      }

      const g = img.gain ?? 0;
      const share = drySum + reflSum > 1e-6 ? g / (drySum + reflSum) : 0;
      const bounceText = `bounce ${g.toFixed(2)} · ${pct01(share)} src · hear ${pct01(img.hear ?? 1)}`;
      if (labelIdx < vizLabels.length) {
        setDebugLabel(
          vizLabels[labelIdx++],
          bounceText,
          bounce.x,
          1.4,
          bounce.z,
          "bounce"
        );
      }
      reflIdx += 2;
    }

    const dryGains = v.lastGains;
    if (dryGains) {
      for (let i = 0; i < dryGains.length; i++) {
        const d = dryGains[i] || 0;
        dryEnergy[i] += d;
        energy[i] += d;
      }
    }
    // Reflection taps → same speaker rings (arrival VBAP × slot gain)
    const slots = v.reflSlots;
    if (slots && slots.length) {
      for (let si2 = 0; si2 < slots.length; si2++) {
        const slot = slots[si2];
        if (!slot || slot.gain < 0.008 || !slot.ch) continue;
        const nch = Math.min(16, slot.ch.length);
        for (let ch = 0; ch < nch; ch++) {
          const shown = slot.gain * (slot.ch[ch] || 0) * 1.35;
          reflEnergy[ch] += shown;
          energy[ch] += shown;
        }
      }
    }
    wetSum += v.lastWet || 0;
  }

  // Speaker energy rings at speaker positions (dry + reflections)
  for (let i = 0; i < speakers.length; i++) {
    const sp = speakers[i];
    const ring = vizSpeakerRings[i];
    if (!ring) continue;
    const g = energy[sp.ch] || 0;
    if (g < 0.015) {
      ring.visible = false;
      continue;
    }
    const { x, z } = angleToXZ(sp.angle, 3.4);
    ring.visible = true;
    // Local to listenerMesh (head-locked with cabinets)
    ring.position.set(x, 0.02 + g * 0.15, z);
    const sc = 0.6 + g * 3.5;
    ring.scale.set(sc, sc, sc);
    ring.material.opacity = Math.min(0.95, 0.25 + g * 1.5);
    // Orange = dry-led, cyan = reflection-led on that channel
    const dry = dryEnergy[sp.ch] || 0;
    const refl = reflEnergy[sp.ch] || 0;
    const reflShare = refl / Math.max(1e-6, dry + refl);
    ring.material.color.setHex(reflShare > 0.45 ? 0x22d3ee : 0xf97316);
    if (labelIdx < vizLabels.length) {
      const w = listenerLocalToWorld(x, 0.55 + g * 0.35, z);
      setDebugLabel(
        vizLabels[labelIdx++],
        `${sp.id} · ${g.toFixed(2)} · dry ${dry.toFixed(2)} · refl ${refl.toFixed(2)}`,
        w.x,
        w.y,
        w.z,
        reflShare > 0.45 ? "spk-refl" : "spk"
      );
    }
  }

  if (vizWetHalo) {
    const wet = Math.min(1.5, wetSum);
    vizWetHalo.visible = wet > 0.02 && !!els.roomOn?.checked;
    vizWetHalo.position.set(listener.x, 0.04, listener.z);
    const sc = 1 + wet * 2.5;
    vizWetHalo.scale.set(sc, sc, sc);
    vizWetHalo.material.opacity = Math.min(0.55, 0.15 + wet * 0.35);
    if (vizWetHalo.visible && labelIdx < vizLabels.length) {
      setDebugLabel(
        vizLabels[labelIdx++],
        `room wet ${wet.toFixed(2)}`,
        listener.x,
        0.55,
        listener.z,
        "wet"
      );
    }
  }
}

/** @type {THREE.Group[]} */
let wallGroups = [];

function clampOccluder(o) {
  // Allow thin slabs (~12 cm); both axes still need a minimum for handles
  const minSpan = 0.12;
  if (o.x1 < o.x0 + minSpan) o.x1 = o.x0 + minSpan;
  if (o.z1 < o.z0 + minSpan) o.z1 = o.z0 + minSpan;
  const lim = 5.5;
  o.x0 = Math.max(-lim, Math.min(lim, o.x0));
  o.x1 = Math.max(-lim, Math.min(lim, o.x1));
  o.z0 = Math.max(-lim, Math.min(lim, o.z0));
  o.z1 = Math.max(-lim, Math.min(lim, o.z1));
  if (o.x1 < o.x0 + minSpan) o.x1 = o.x0 + minSpan;
  if (o.z1 < o.z0 + minSpan) o.z1 = o.z0 + minSpan;
}

function syncWallMeshFromOccluder(group, o) {
  const w = o.x1 - o.x0;
  const d = o.z1 - o.z0;
  const cx = (o.x0 + o.x1) / 2;
  const cz = (o.z0 + o.z1) / 2;
  group.position.set(cx, 0, cz);
  const body = group.userData.body;
  body.scale.set(w, 1, d);
  body.position.set(0, 0.68, 0);
  // Corner handles in local space
  const handles = group.userData.handles;
  const corners = {
    nw: [-w / 2, d / 2],
    ne: [w / 2, d / 2],
    sw: [-w / 2, -d / 2],
    se: [w / 2, -d / 2],
  };
  for (const [key, [lx, lz]] of Object.entries(corners)) {
    handles[key].position.set(lx, 1.35, lz);
  }
}

function rebuildWallMeshes() {
  for (const g of wallGroups) {
    scene.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  wallGroups = [];

  for (let i = 0; i < occluders.length; i++) {
    clampOccluder(occluders[i]);
    const o = occluders[i];
    const g = new THREE.Group();
    g.userData.dragId = `wall-${i}`;
    g.userData.kind = "wall";
    g.userData.occluderIndex = i;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.55,
        roughness: 0.85,
      })
    );
    body.userData.dragId = `wall-${i}`;
    body.userData.kind = "wall";
    body.userData.occluderIndex = i;
    g.add(body);
    g.userData.body = body;

    const handles = {};
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          emissiveIntensity: 0.4,
        })
      );
      h.userData.dragId = `wallhandle-${i}-${corner}`;
      h.userData.kind = "wall-handle";
      h.userData.occluderIndex = i;
      h.userData.corner = corner;
      g.add(h);
      handles[corner] = h;
    }
    g.userData.handles = handles;
    syncWallMeshFromOccluder(g, o);
    scene.add(g);
    wallGroups.push(g);
  }
  refreshDraggables();
  refreshWallList();
  highlightSelectedWall();
}

function angleToXZ(angle, radius) {
  return { x: Math.sin(angle) * radius, z: -Math.cos(angle) * radius };
}

/** Listener-local (x,y,z) → world, matching Three.js Ry(yaw) on listenerMesh. */
function listenerLocalToWorld(lx, ly, lz) {
  const c = Math.cos(listener.yaw);
  const s = Math.sin(listener.yaw);
  return {
    x: listener.x + c * lx + s * lz,
    y: ly,
    z: listener.z - s * lx + c * lz,
  };
}

function updatePathLine() {
  const pts = [new THREE.Vector3(walk.x, 0.06, walk.z)];
  if (
    Math.hypot(walk.targetX - walk.x, walk.targetZ - walk.z) > 0.05 ||
    walk.path.length
  ) {
    pts.push(new THREE.Vector3(walk.targetX, 0.06, walk.targetZ));
  }
  for (const p of walk.path) {
    pts.push(new THREE.Vector3(p.x, 0.06, p.z));
  }
  if (pts.length === 1) {
    pts.push(new THREE.Vector3(walk.goalX, 0.06, walk.goalZ));
  }
  pathLine.geometry.setFromPoints(pts);
}

function updateListenerPathLine() {
  if (!listenerPathLine) return;
  if (!listenNav.active) {
    listenerPathLine.visible = false;
    return;
  }
  const pts = [new THREE.Vector3(listener.x, 0.08, listener.z)];
  if (Number.isFinite(listenNav.targetX) && Number.isFinite(listenNav.targetZ)) {
    pts.push(new THREE.Vector3(listenNav.targetX, 0.08, listenNav.targetZ));
  }
  for (const p of listenNav.path) {
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) {
      pts.push(new THREE.Vector3(p.x, 0.08, p.z));
    }
  }
  if (pts.length < 2) {
    pts.push(pts[0].clone().add(new THREE.Vector3(0, 0, -0.01)));
  }
  listenerPathLine.visible = true;
  listenerPathLine.geometry.setFromPoints(pts);
}

function rebuildSpeakerVisuals() {
  while (speakerGroup.children.length) {
    const c = speakerGroup.children[0];
    speakerGroup.remove(c);
  }
  while (roomGroup.children.length) {
    const c = roomGroup.children[0];
    roomGroup.remove(c);
  }
  const layout = LAYOUTS[els.layout.value];
  for (const sp of layout.speakers) {
    if (sp.isLfe) {
      const sub = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x4a5562 })
      );
      // Head-locked LFE slightly in front of the seat
      sub.position.set(0, 0.16, -0.85);
      speakerGroup.add(sub);
      continue;
    }
    const { x, z } = angleToXZ(sp.angle, 3.4);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.5, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x3d4d60 })
    );
    mesh.position.set(x, 0.26, z);
    // Face the listener (local origin) without world lookAt
    mesh.lookAt(0, 0.26, 0);
    speakerGroup.add(mesh);
  }

  // Room footprint outline (world-fixed)
  const rw = roomWidth();
  const rd = roomDepth();
  const rh = roomHeightM();
  const roomBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(rw, rh, rd)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 })
  );
  roomBox.position.y = rh / 2;
  roomGroup.add(roomBox);

  updatePathLine();
}

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 1 || h < 1) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// --- lifecycle -------------------------------------------------------------

function setStatus(t) {
  els.status.textContent = t;
}

function updateLabels() {
  els.ambiVolOut.textContent = `${els.ambiVol.value}%`;
  els.ambiDriftOut.textContent = `${(Number(els.ambiDrift.value) / 100).toFixed(2)} Hz`;
  els.walkVolOut.textContent = `${els.walkVol.value}%`;
  els.walkSpeedOut.textContent = `${maxWalkSpeed().toFixed(1)} m/s`;
  els.walkStrideOut.textContent = `${strideLen().toFixed(2)} m`;
  els.walkRadiusOut.textContent = `${wanderRadius().toFixed(1)} m`;
  els.uiVolOut.textContent = `${els.uiVol.value}%`;
  els.fallVolOut.textContent = `${els.fallVol.value}%`;
  els.birdVolOut.textContent = `${els.birdVol.value}%`;
  els.birdCountOut.textContent = `${birdCount()}`;
  els.birdRateOut.textContent = `${birdChirpHz().toFixed(2)} Hz`;
  els.birdFlyOut.textContent = `${maxBirdFlySpeed().toFixed(1)} m/s`;
  if (els.roomSizeOut) els.roomSizeOut.textContent = `${roomWidth().toFixed(1)} m`;
  if (els.roomHeightOut) els.roomHeightOut.textContent = `${roomHeightM().toFixed(1)} m`;
  if (els.roomAbsOut) els.roomAbsOut.textContent = roomAbsorption().toFixed(2);
  if (els.roomWetOut) els.roomWetOut.textContent = `${els.roomWet.value}%`;
}

async function enableAudio() {
  if (ctx) {
    stopScene();
    teardownVoices();
    try {
      await ctx.close();
    } catch {
      /* noop */
    }
    ctx = null;
    audioReady = false;
  }
  ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  await new Promise((r) => setTimeout(r, 50));

  // Bust flap cache so soft wing wavs replace any old magic/snare samples
  bufferCache.delete("flap1");
  bufferCache.delete("flap2");
  rebuildBus();
  // Mark ready only after the graph exists so the render loop won't touch half-built voices
  audioReady = true;
  bumpSpatSettle(6);

  // Prefetch (async — don't block Start)
  for (const id of Object.keys(SAMPLE_URLS)) {
    loadBuffer(id).catch(() => {});
  }

  els.btnStop.disabled = false;
  els.btnUiClick.disabled = false;
  els.btnUiOk.disabled = false;
  els.btnUiPop.disabled = false;
  els.compat.textContent =
    `Dry VBAP/FOA + occlusion walls · room bus (instant early taps + Sabine IR). ` +
    `No reflection/early DelayNodes — bounce is gain/HPF/direction only.`;
}

async function startScene() {
  if (!audioReady) {
    await enableAudio();
  } else if (ctx?.state === "suspended") {
    await ctx.resume();
  }
  sceneRunning = true;
  resetWalker();
  syncLevels();
  await startAmbi();
  await startWaterfall();
  for (let i = 0; i < birds.length; i++) {
    birds[i].chirpNext = 0.2 + Math.random() * 1.0;
    birds[i].pause = Math.random() * 0.4;
    if (birds[i].pause <= 0) pickBirdTarget(birds[i]);
  }
  els.btnStart.textContent = "Running…";
  els.btnStart.disabled = true;
  els.btnStop.disabled = false;
  setStatus(`Scene · ${activeChannels}ch`);
}

function stopScene() {
  sceneRunning = false;
  stopAmbiSources();
  stopWaterfall();
  els.btnStart.textContent = "Start";
  els.btnStart.disabled = false;
  setStatus(audioReady ? "Stopped" : "Audio off");
}

// --- animate ---------------------------------------------------------------

const clock = new THREE.Clock();
let ambiPhase = 0;
/** Extra frames of global spat refresh so lerps settle after listener/wall moves. */
let spatSettle = 0;
/** Accumulators for throttled spat / viz while scene runs. */
let spatAccum = 0;
let vizAccum = 0;
const SPAT_PERIOD = 1 / 14; // ~14 Hz while running / still
const SPAT_SETTLE_PERIOD = 1 / 28; // brief faster spat after moves (not every frame)
const VIZ_PERIOD = 1 / 20;

const perf = {
  frameMs: 0,
  spatMs: 0,
  vizMs: 0,
  stalls: 0,
  spatHz: 0,
  _spatCount: 0,
  _spatWindowT: 0,
  _uiT: 0,
  lastStallMs: 0,
};

function bumpSpatSettle(updates = 20) {
  spatSettle = Math.max(spatSettle, updates);
}

function padNum(n, intDigits, fracDigits = 0) {
  const v = Number.isFinite(n) ? n : 0;
  const s = fracDigits > 0 ? v.toFixed(fracDigits) : String(Math.round(v));
  return s.padStart(intDigits + (fracDigits > 0 ? fracDigits + 1 : 0), " ");
}

function updatePerfHud(dt) {
  perf._spatWindowT += dt;
  if (perf._spatWindowT >= 1) {
    perf.spatHz = perf._spatCount / perf._spatWindowT;
    perf._spatCount = 0;
    perf._spatWindowT = 0;
  }
  perf._uiT += dt;
  if (perf._uiT < 0.25 || !els.perfStats) return;
  perf._uiT = 0;
  const ctxState = (ctx?.state || "off").padEnd(9, " ");
  const el = els.perfStats;
  // Fixed-width fields so the line doesn't jitter as digits change
  el.textContent =
    `f${padNum(perf.frameMs, 2, 1)}` +
    ` s${padNum(perf.spatMs, 2, 1)}@${padNum(perf.spatHz, 2)}Hz` +
    ` v${padNum(perf.vizMs, 2, 1)}` +
    ` #${padNum(perf.stalls, 4)}` +
    `/${padNum(perf.lastStallMs, 3)}` +
    ` ${ctxState}` +
    `~${padNum(spatSettle, 2)}`;
  el.title =
    `frame ms · spat ms @Hz · viz ms · stalls/lastStallMs · AudioContext · settle`;
  el.classList.remove("warn", "bad");
  if (perf.frameMs > 28 || perf.spatMs > 12 || (ctx && ctx.state !== "running")) {
    el.classList.add(perf.frameMs > 40 || (ctx && ctx.state !== "running") ? "bad" : "warn");
  }
}

function tick() {
  requestAnimationFrame(tick);
  const frameStart = performance.now();
  const dt = Math.min(clock.getDelta(), 0.05);
  viewControls.update();

  if (sceneRunning) {
    const driftHz = Number(els.ambiDrift.value) / 100;
    ambiPhase += driftHz * Math.PI * 2 * dt;
    // Pose only here — applySpatial is throttled below (was every-frame → audio dropouts)
    placeAmbiBeds(ambiPhase, { apply: false });
    for (let i = 0; i < ambiMeshes.length; i++) {
      const v = ambiVoices[i];
      if (v) ambiMeshes[i].position.set(v.x, 1.1, v.z);
      ambiMeshes[i].visible = els.ambiOn.checked;
    }
    updateWalker(dt);
    updateBirds(dt);
  } else {
    for (let i = 0; i < ambiMeshes.length; i++) {
      const v = ambiVoices[i];
      if (v) ambiMeshes[i].position.set(v.x, 1.1, v.z);
    }
    syncWalkerVisuals();
  }
  updateListenerNav(dt);

  // Throttled spat: ~14 Hz while running; ~28 Hz for a few updates after moves.
  // Never every-frame — that stalled the audio thread when standing still.
  spatAccum += dt;
  const spatPeriod = spatSettle > 0 ? SPAT_SETTLE_PERIOD : SPAT_PERIOD;
  const needSpat =
    audioReady &&
    (sceneRunning || spatSettle > 0) &&
    spatAccum >= spatPeriod;
  if (needSpat) {
    const t0 = performance.now();
    refreshAcoustics();
    perf.spatMs = performance.now() - t0;
    perf._spatCount++;
    if (spatSettle > 0) spatSettle--;
    spatAccum = 0;
  }

  // Front/back visual: green fan = front, cool/dim sources = behind
  const showFB = !!els.frontBack?.checked;
  if (listenerMesh.userData.frontFan) listenerMesh.userData.frontFan.visible = showFB;
  if (listenerMesh.userData.rearFan) listenerMesh.userData.rearFan.visible = showFB;
  tintSourceBehind(walkerMesh, walk.x, walk.z);
  tintSourceBehind(waterfallMesh, waterfallMesh.position.x, waterfallMesh.position.z);
  for (let i = 0; i < ambiMeshes.length; i++) {
    const v = ambiVoices[i];
    if (v) tintSourceBehind(ambiMeshes[i], v.x, v.z);
  }
  for (let i = 0; i < birdMeshes.length; i++) {
    const b = birds[i];
    if (b) tintSourceBehind(birdMeshes[i], b.x, b.z);
  }

  vizAccum += dt;
  if (vizAccum >= VIZ_PERIOD || !els.vizOn?.checked) {
    const t1 = performance.now();
    updateAcousticsViz();
    perf.vizMs = performance.now() - t1;
    vizAccum = 0;
  }

  renderer.render(scene, camera);

  perf.frameMs = performance.now() - frameStart;
  if (perf.frameMs > 32) {
    perf.stalls++;
    perf.lastStallMs = perf.frameMs;
  }
  updatePerfHud(dt);

  // Resume audio if the browser suspended the context (tab focus, etc.)
  if (ctx && ctx.state === "suspended" && sceneRunning) {
    ctx.resume().catch(() => {});
  }
}

// --- UI --------------------------------------------------------------------

els.btnStart.addEventListener("click", () => {
  startScene().catch((err) => {
    setStatus("Failed");
    els.compat.textContent = err.message;
  });
});
els.btnStop.addEventListener("click", stopScene);

els.layout.addEventListener("change", () => {
  if (audioReady) {
    const was = sceneRunning;
    stopScene();
    rebuildBus();
    if (was) startScene();
  } else rebuildSpeakerVisuals();
});

for (const el of [
  els.ambiVol,
  els.ambiDrift,
  els.walkVol,
  els.walkSpeed,
  els.walkStride,
  els.walkRadius,
  els.uiVol,
]) {
  el.addEventListener("input", () => {
    updateLabels();
    syncLevels();
  });
}
els.ambiOn.addEventListener("change", () => {
  syncLevels();
  if (sceneRunning) {
    if (els.ambiOn.checked) startAmbi();
    else stopAmbiSources();
  }
});
els.walkOn.addEventListener("change", syncLevels);

els.fallOn.addEventListener("change", () => {
  syncLevels();
  if (sceneRunning) {
    if (els.fallOn.checked) startWaterfall();
    else stopWaterfall();
  }
});
els.fallSpatial.addEventListener("change", () => {
  if (waterfallVoice) waterfallVoice.setMode(els.fallSpatial.value);
});
els.fallSound.addEventListener("change", () => {
  if (sceneRunning && els.fallOn.checked) startWaterfall();
});

els.birdOn.addEventListener("change", syncLevels);
els.birdSpatial.addEventListener("change", () => {
  for (const v of birdVoices) v.setMode(els.birdSpatial.value);
});
els.birdCount.addEventListener("input", () => {
  updateLabels();
  if (audioReady) rebuildBirdAgents();
  else {
    const count = birdCount();
    while (birds.length < count) birds.push(makeBirdAgent(birds.length));
    while (birds.length > count) birds.pop();
    rebuildBirdMeshes();
  }
  refreshVizFocusOptions();
});

els.vizOn.addEventListener("change", () => {
  if (!els.vizOn.checked) vizGroup.visible = false;
});
els.vizFocus.addEventListener("change", () => updateAcousticsViz());

for (const el of [els.fallVol, els.birdVol, els.birdRate, els.birdFly, els.birdCount]) {
  el.addEventListener("input", () => {
    updateLabels();
    syncLevels();
  });
}

function setPointerFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickDraggable() {
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(draggables, true);
  if (!hits.length) return null;
  // Prefer orange resize handles over wall body
  for (const hit of hits) {
    let o = hit.object;
    while (o && !o.userData.dragId && o.parent) o = o.parent;
    if (o?.userData.kind === "wall-handle") return o;
  }
  // Prefer listener when the ray grazes it among other objects
  for (const hit of hits) {
    let o = hit.object;
    while (o && !o.userData.dragId && o.parent) o = o.parent;
    if (o?.userData.dragId === "listener") return o;
  }
  let o = hits[0].object;
  while (o && !o.userData.dragId && o.parent) o = o.parent;
  if (o?.userData.kind === "wall") {
    const idx = o.userData.occluderIndex;
    return wallGroups[idx] || o;
  }
  return o?.userData.dragId ? o : null;
}

/** @type {{ x: number, z: number } | null} */
let wallDragGrab = null;

function moveDragTarget(clientX, clientY) {
  if (!dragTarget) return;
  setPointerFromEvent({ clientX, clientY });
  raycaster.setFromCamera(pointerNdc, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, groundHit)) return;
  const x = Math.max(-5.5, Math.min(5.5, groundHit.x));
  const z = Math.max(-5.5, Math.min(5.5, groundHit.z));

  const kind = dragTarget.userData.kind;
  if (kind === "wall-handle") {
    const i = dragTarget.userData.occluderIndex;
    const corner = dragTarget.userData.corner;
    const o = occluders[i];
    if (!o) return;
    if (corner === "nw") {
      o.x0 = x;
      o.z1 = z;
    } else if (corner === "ne") {
      o.x1 = x;
      o.z1 = z;
    } else if (corner === "sw") {
      o.x0 = x;
      o.z0 = z;
    } else if (corner === "se") {
      o.x1 = x;
      o.z0 = z;
    }
    // Keep min size / order
    if (o.x1 < o.x0) {
      const t = o.x0;
      o.x0 = o.x1;
      o.x1 = t;
    }
    if (o.z1 < o.z0) {
      const t = o.z0;
      o.z0 = o.z1;
      o.z1 = t;
    }
    clampOccluder(o);
    syncWallMeshFromOccluder(wallGroups[i], o);
    refreshAcoustics();
    return;
  }

  if (kind === "wall") {
    const i = dragTarget.userData.occluderIndex;
    const o = occluders[i];
    if (!o) return;
    const w = o.x1 - o.x0;
    const d = o.z1 - o.z0;
    let cx = x;
    let cz = z;
    if (wallDragGrab) {
      cx = x - wallDragGrab.x;
      cz = z - wallDragGrab.z;
    }
    o.x0 = cx - w / 2;
    o.x1 = cx + w / 2;
    o.z0 = cz - d / 2;
    o.z1 = cz + d / 2;
    clampOccluder(o);
    syncWallMeshFromOccluder(wallGroups[i], o);
    refreshAcoustics();
    return;
  }

  const id = dragTarget.userData.dragId;
  if (id === "listener") {
    setListenerPosition(x, z);
    return;
  }

  dragTarget.position.set(x, 0, z);
  if (id === "waterfall") syncWaterfallVisual();
  else if (id?.startsWith("bird-")) {
    const i = Number(id.split("-")[1]);
    if (birds[i]) {
      birds[i].x = x;
      birds[i].z = z;
      birds[i].y = Math.max(birds[i].y, 0.7);
      birds[i].speed = 0;
      birds[i].dragHold = 0.35;
      birds[i].pause = 0.15;
    }
    if (birdVoices[i]) birdVoices[i].setPosition(x, z, { apply: false });
    bumpSpatSettle(6);
  }
}

/** Tap-to-go: empty-ground click that didn't become an orbit drag → move listener. */
let tapPointer = null;

function commandListenerToGround(clientX, clientY) {
  setPointerFromEvent({ clientX, clientY });
  raycaster.setFromCamera(pointerNdc, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, groundHit)) return;
  const x = Math.max(-5.5, Math.min(5.5, groundHit.x));
  const z = Math.max(-5.5, Math.min(5.5, groundHit.z));
  commandListenerTo(x, z);
}

canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (e.button !== 0) return;
    setPointerFromEvent(e);
    dragTarget = pickDraggable();
    tapPointer = null;
    if (!dragTarget) {
      tapPointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      return;
    }
    viewControls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    wallDragGrab = null;
    const kind = dragTarget.userData.kind;
    if (kind === "wall" || kind === "wall-handle") {
      selectedWallIndex = dragTarget.userData.occluderIndex ?? -1;
      highlightSelectedWall();
      refreshWallList();
    }
    if (kind === "wall") {
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(dragPlane, groundHit)) {
        const i = dragTarget.userData.occluderIndex;
        const o = occluders[i];
        const cx = (o.x0 + o.x1) / 2;
        const cz = (o.z0 + o.z1) / 2;
        wallDragGrab = { x: groundHit.x - cx, z: groundHit.z - cz };
      }
    }
    moveDragTarget(e.clientX, e.clientY);
  },
  { passive: true }
);

canvas.addEventListener(
  "pointermove",
  (e) => {
    if (dragTarget) {
      moveDragTarget(e.clientX, e.clientY);
      return;
    }
    if (tapPointer && e.pointerId === tapPointer.id) {
      const dx = e.clientX - tapPointer.x;
      const dy = e.clientY - tapPointer.y;
      if (dx * dx + dy * dy > 64) tapPointer.moved = true; // >8px → orbit, not tap
    }
  },
  { passive: true }
);

function endDrag(e) {
  if (tapPointer && e.pointerId === tapPointer.id) {
    const wasTap = !tapPointer.moved;
    tapPointer = null;
    if (wasTap) commandListenerToGround(e.clientX, e.clientY);
    return;
  }
  if (!dragTarget) return;
  const id = dragTarget.userData.dragId;
  if (id?.startsWith("bird-")) {
    const i = Number(id.split("-")[1]);
    if (birds[i]) {
      birds[i].dragHold = 0;
      pickBirdTarget(birds[i]);
    }
  }
  if (id === "listener" && audioReady) {
    // Refresh room early-reflection VBAP directions for new listener seat
    refreshRoomFromUI();
    bumpSpatSettle(12);
  } else if (audioReady && (id === "waterfall" || id?.startsWith("bird-"))) {
    bumpSpatSettle(8);
  }
  // Walls moved — refresh routes around new geometry
  if (
    id?.startsWith("wall") ||
    dragTarget.userData?.kind === "wall" ||
    dragTarget.userData?.kind === "wall-handle"
  ) {
    setWalkDestination(walk.goalX, walk.goalZ);
    repathListenerNav();
  }
  dragTarget = null;
  wallDragGrab = null;
  viewControls.enabled = true;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", (e) => {
  tapPointer = null;
  endDrag(e);
});

function refreshAcoustics() {
  if (walkVoice) walkVoice.applySpatial();
  for (const v of ambiVoices) v.applySpatial();
  if (waterfallVoice) waterfallVoice.applySpatial();
  for (const v of birdVoices) v.applySpatial();
  if (uiVoice) uiVoice.applySpatial();
}

els.air.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(12);
});
els.distanceAtten.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(12);
});
els.nearField.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(12);
});
els.occlusion.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(18);
});
els.frontBack?.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(12);
});

els.roomOn.addEventListener("change", () => {
  refreshRoomFromUI();
});
for (const el of [els.roomSize, els.roomHeight, els.roomAbs, els.roomWet]) {
  el.addEventListener("input", () => {
    refreshRoomFromUI();
    rebuildSpeakerVisuals();
  });
}

els.btnUiClick.addEventListener("click", () => playUi("click"));
els.btnUiOk.addEventListener("click", () => playUi("ok"));
els.btnUiPop.addEventListener("click", () => playUi("pop"));

window.addEventListener("resize", resize);

// —— Photoshop shell: dock tabs ——
document.querySelectorAll(".ps-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const id = tab.dataset.panel;
    document.querySelectorAll(".ps-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".ps-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${id}`);
    });
    if (id === "scene") refreshSceneJsonField();
  });
});

function bindClick(el, fn) {
  el?.addEventListener("click", fn);
}

bindClick(els.btnAddWall, () => addWall());
bindClick(els.btnAddWallPanel, () => addWall());
bindClick(els.toolAddWall, () => {
  addWall();
  els.toolOrbit?.classList.add("active");
  els.toolAddWall?.classList.remove("active");
});
bindClick(els.btnRemoveWall, () => removeSelectedOrLastWall());
bindClick(els.btnRemoveWallPanel, () => removeSelectedOrLastWall());
bindClick(els.btnExportScene, () => copySceneToClipboard());
bindClick(els.btnCopyScene, () => copySceneToClipboard());
bindClick(els.btnImportScene, () => pasteSceneFromClipboard());
bindClick(els.btnPasteScene, () => pasteSceneFromClipboard());
bindClick(els.btnLoadDefault, () => loadDefaultLayout());
bindClick(els.btnRefreshJson, () => refreshSceneJsonField());
bindClick(els.btnApplyJson, () => {
  try {
    applyScene(JSON.parse(els.sceneJson.value));
  } catch (err) {
    setStatus("Invalid JSON");
    console.warn(err);
  }
});

bindClick(els.toolOrbit, () => {
  els.toolOrbit?.classList.add("active");
  els.toolAddWall?.classList.remove("active");
});

window.addEventListener("keydown", (e) => {
  if (e.target.matches?.("input, textarea, select")) return;
  if ((e.key === "Delete" || e.key === "Backspace") && selectedWallIndex >= 0) {
    e.preventDefault();
    removeSelectedOrLastWall();
  }
});

updateLabels();
rebuildSpeakerVisuals();
rebuildWallMeshes();
// Seed default birds for visuals before audio
birds = Array.from({ length: birdCount() }, (_, i) => makeBirdAgent(i));
rebuildBirdMeshes();
refreshVizFocusOptions();
refreshDraggables();
resetWalker();
resize();
tick();
refreshSceneJsonField();
setStatus("Audio off");
loadDefaultLayout().catch(() => {
  /* keep inline defaults */
});

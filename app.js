/**
 * Surround Mixer demo app — Three.js scene + UI.
 * Audio spat lives in spat-engine.js (SurroundEngine).
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  SurroundEngine,
  LAYOUTS,
  LISTENER_EAR_Y,
  behindAmount,
  orbitSpeakers,
} from "./spat-engine.js";

/** @type {SurroundEngine} */
const spat = new SurroundEngine();

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
  floorOcc: document.getElementById("floor-occ"),
  floorHeight: document.getElementById("floor-height"),
  floorHeightOut: document.getElementById("floor-height-out"),
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
  walkUpOn: document.getElementById("walk-up-on"),
  walkUpVol: document.getElementById("walk-up-vol"),
  walkUpVolOut: document.getElementById("walk-up-vol-out"),
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

const listener = spat.listener;

function listenerEarY() {
  return LISTENER_EAR_Y;
}
function floorDeckY() {
  return spat.floorDeckY();
}
function floorThicknessM() {
  return 0.22;
}
function walkerGroundY() {
  return 0.12;
}
function walkerUpY() {
  return floorDeckY() + 0.12;
}

function syncSpatFromUI() {
  spat.setLayout(els.layout.value);
  spat.setSettings({
    air: !!els.air?.checked,
    distanceAtten: !!els.distanceAtten?.checked,
    nearField: !!els.nearField?.checked,
    occlusion: !!els.occlusion?.checked,
    floorOcc: !!els.floorOcc?.checked,
    frontBack: !!els.frontBack?.checked,
    roomOn: !!els.roomOn?.checked,
    floorHeightM: Number(els.floorHeight?.value ?? 28) / 10,
    roomSizeM: Number(els.roomSize?.value ?? 80) / 10,
    roomHeightM: Number(els.roomHeight?.value ?? 30) / 10,
    roomAbs: Number(els.roomAbs?.value ?? 35) / 100,
    roomWet: Number(els.roomWet?.value ?? 25) / 100,
  });
  spat.setOccluders(occluders);
  spat.setListener(listener.x, listener.z, listener.yaw);
}

spat.onRoomStats = (metrics) => {
  if (!els.roomStats) return;
  els.roomStats.textContent =
    `V=${metrics.V.toFixed(1)} m³ · S=${metrics.S.toFixed(1)} m² · ` +
    `Sabine RT60≈${metrics.rt60.toFixed(2)} s · abs=${metrics.abs.toFixed(2)}`;
};

function volCurve(pct) {
  const p = Number(pct) / 100;
  return p * p;
}

function normalizeAngle(a) {
  const t = Math.PI * 2;
  let x = a % t;
  if (x <= -Math.PI) x += t;
  if (x > Math.PI) x -= t;
  return x;
}
function shortestAngleDelta(from, to) {
  return normalizeAngle(to - from);
}
function yawFromDir(dx, dz) {
  return Math.atan2(-dx, -dz);
}
function smoothListenerYaw(dt, targetYaw, sharpness = 5.5) {
  const d = shortestAngleDelta(listener.yaw, targetYaw);
  const t = 1 - Math.exp(-sharpness * dt);
  listener.yaw = normalizeAngle(listener.yaw + d * t);
}
function angleToXZ(angle, radius) {
  return { x: Math.sin(angle) * radius, z: -Math.cos(angle) * radius };
}
function listenerLocalToWorld(lx, ly, lz) {
  const c = Math.cos(listener.yaw);
  const s = Math.sin(listener.yaw);
  return {
    x: listener.x + c * lx + s * lz,
    y: ly,
    z: listener.z - s * lx + c * lz,
  };
}
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function pointInRect(px, pz, r) {
  return px >= r.x0 && px <= r.x1 && pz >= r.z0 && pz <= r.z1;
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

/** Mutable occluder AABBs on XZ (draggable / resizable walls). */
let occluders = [
  { x0: -3.4, z0: -0.5, x1: -1.8, z1: 0.25 },
  { x0: 1.9, z0: -3.2, x1: 3.5, z1: -2.5 },
];
/** Index into occluders for UI selection / delete. */
let selectedWallIndex = -1;

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

// Ambient uses several FOA Voices at fixed offsets; walker is one VBAP Voice; UI is one Voice.
/** @type {Voice[]} */
let ambiVoices = [];
/** @type {AudioBufferSourceNode[]} */
let ambiSources = [];
/** @type {Voice | null} */
let walkVoice = null;
/** @type {Voice | null} */
let walkUpVoice = null;
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

/**
 * Fixed room FOA beds (world positions) — not a ring spinning around the listener.
 * Tiny sway only; beds skip wall occlusion so drift doesn't pump level.
 */
const AMBI_WORLD = [
  { x: -3.4, z: -2.9 },
  { x: 3.2, z: -2.6 },
  { x: -3.0, z: 2.8 },
  { x: 3.1, z: 2.5 },
];

function birdCount() {
  return Math.max(1, Math.min(8, Number(els.birdCount?.value || 3)));
}
function maxBirdFlySpeed() {
  return Number(els.birdFly.value) / 10;
}


async function loadSample(id) {
  const url = SAMPLE_URLS[id];
  if (!url) throw new Error(`Unknown sample ${id}`);
  // Bust cache for waterfall swaps
  return spat.loadBuffer(url);
}

function rebuildBus() {
  syncSpatFromUI();
  // Drop previous voice handles; SurroundEngine.rebuildGraph detaches nodes
  for (const v of [...ambiVoices, walkVoice, walkUpVoice, waterfallVoice, uiVoice, ...birdVoices]) {
    if (v) spat.detachVoice(v);
  }
  ambiVoices = [];
  walkVoice = null;
  walkUpVoice = null;
  waterfallVoice = null;
  uiVoice = null;
  birdVoices = [];

  const n = spat.rebuildGraph();
  const layout = spat.layout;

  ambiVoices = AMBI_WORLD.map(() => spat.createVoice("foa", { bed: true }));
  walkVoice = spat.createVoice("vbap");
  walkVoice.y = walkerGroundY();
  walkUpVoice = spat.createVoice("vbap");
  walkUpVoice.y = walkerUpY();
  waterfallVoice = spat.createVoice(els.fallSpatial.value);
  waterfallVoice.setPosition(waterfallMesh.position.x, waterfallMesh.position.z, {
    apply: false,
    y: 0.9,
  });
  rebuildBirdAgents(n, { apply: false });
  uiVoice = spat.createVoice("ui");

  placeAmbiBeds(0, { apply: false });
  syncLevels({ apply: false });
  refreshAcoustics();

  els.caps.textContent =
    `${layout.label} · ${n}ch · FOA beds + walkers + fall + ${birds.length} birds + UI` +
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
    const v = spat.createVoice(els.birdSpatial.value);
    v.setPosition(birds[i].x, birds[i].z, { apply: false, y: birds[i].y });
    birdVoices.push(v);
  }

  rebuildBirdMeshes();
  syncLevels({ apply });
  if (apply) refreshAcoustics();
}

function placeAmbiBeds(driftPhase = 0, { apply = false } = {}) {
  for (let i = 0; i < ambiVoices.length; i++) {
    const v = ambiVoices[i];
    if (!v) continue;
    const base = AMBI_WORLD[i] || AMBI_WORLD[0];
    // Slight sway in place — not a surround orbit through the speaker ring
    const sway = 0.12;
    v.x = base.x + Math.sin(driftPhase * 0.35 + i * 1.7) * sway;
    v.y = 1.2;
    v.z = base.z + Math.cos(driftPhase * 0.28 + i * 1.1) * sway;
    if (apply) v.applySpatial();
  }
}

function syncLevels({ apply = true } = {}) {
  const ambi = els.ambiOn.checked ? volCurve(els.ambiVol.value) : 0;
  for (const v of ambiVoices) v.setLevel(ambi * 0.55, { apply });

  if (walkVoice) {
    walkVoice.setLevel(els.walkOn.checked ? volCurve(els.walkVol.value) : 0, { apply });
  }
  if (walkUpVoice) {
    walkUpVoice.setLevel(
      els.walkUpOn?.checked ? volCurve(els.walkUpVol?.value ?? 50) : 0,
      { apply }
    );
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
  spat.clearBuffer(SAMPLE_URLS[id] || id);
  let buf;
  if (id === "waterfall") {
    try {
      buf = await loadSample("waterfall");
    } catch {
      buf = createWaterNoiseBuffer(8);
    }
  } else {
    buf = await loadSample(id);
  }
  const src = spat.ctx.createBufferSource();
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
  const length = Math.floor(spat.ctx.sampleRate * seconds);
  const buffer = spat.ctx.createBuffer(1, length, spat.ctx.sampleRate);
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
  const lpLow = Math.exp((-2 * Math.PI * 700) / spat.ctx.sampleRate);
  const lpMid = Math.exp((-2 * Math.PI * 3200) / spat.ctx.sampleRate);
  const hpMid = Math.exp((-2 * Math.PI * 400) / spat.ctx.sampleRate);
  const hpHi = Math.exp((-2 * Math.PI * 4500) / spat.ctx.sampleRate);

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
    const fade = Math.min(i, length - 1 - i, spat.ctx.sampleRate * 0.15) / (spat.ctx.sampleRate * 0.15);
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
  const buf = await loadSample(els.birdSound.value);
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
    buf = await loadSample(id);
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
  if (spat.bufferCache.has(key)) return spat.bufferCache.get(key);
  const dur = 0.085;
  const length = Math.floor(spat.ctx.sampleRate * dur);
  const buffer = spat.ctx.createBuffer(1, length, spat.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let lp = 0;
  const cut = 200 + brightness * 140;
  const a = Math.exp((-2 * Math.PI * cut) / spat.ctx.sampleRate);
  for (let i = 0; i < length; i++) {
    const t = i / Math.max(1, length - 1);
    const env = Math.sin(Math.PI * t) ** 2.4;
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.03 * white) / 1.03;
    lp = a * lp + (1 - a) * brown;
    data[i] = Math.max(-1, Math.min(1, lp * env * 0.65));
  }
  spat.bufferCache.set(key, buffer);
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
      if (birdVoices[i]) birdVoices[i].setPosition(b.x, b.z, { apply: false, y: b.y });
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

      if (birdVoices[i]) birdVoices[i].setPosition(b.x, b.z, { apply: false, y: b.y });
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
  const buf = await loadSample("rainforest");
  for (let i = 0; i < ambiVoices.length; i++) {
    const voice = ambiVoices[i];
    if (!voice.input) continue;
    const src = spat.ctx.createBufferSource();
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

function makeWalkerState(x, z) {
  return {
    x,
    z,
    vx: 0,
    vz: 0,
    speed: 0,
    targetX: x,
    targetZ: z,
    goalX: x,
    goalZ: z,
    /** @type {{ x: number, z: number }[]} */
    path: [],
    strideAcc: 0,
    footAlt: 0,
    pause: 0,
    arriving: false,
  };
}

const walk = makeWalkerState(-2.2, -1.6);
walk.targetX = 2.0;
walk.targetZ = -1.2;
walk.goalX = 2.0;
walk.goalZ = -1.2;

/** Upstairs twin — same XZ nav, elevated y through the floor slab. */
const walkUp = makeWalkerState(2.1, 1.4);
walkUp.targetX = -1.5;
walkUp.targetZ = 2.0;
walkUp.goalX = -1.5;
walkUp.goalZ = 2.0;

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

function setWalkDestination(agent, x, z) {
  const goal = nearestClearPoint(x, z);
  agent.goalX = goal.x;
  agent.goalZ = goal.z;
  agent.path = findNavPath(agent.x, agent.z, goal.x, goal.z);
  const first = agent.path.shift() || goal;
  agent.targetX = first.x;
  agent.targetZ = first.z;
  agent.arriving = false;
  agent.pause = 0;
}

function pickWalkTarget(agent) {
  const R = wanderRadius();
  const minR = Math.max(1.1, R * 0.35);
  let chosen = null;
  for (let tries = 0; tries < 30; tries++) {
    const p = randomClearPoint(minR, R);
    if (Math.hypot(p.x - agent.x, p.z - agent.z) >= R * 0.3) {
      chosen = p;
      break;
    }
  }
  if (!chosen) chosen = randomClearPoint(minR, R);
  setWalkDestination(agent, chosen.x, chosen.z);
}

function resetWalkerAgent(agent) {
  const R = wanderRadius();
  const p = randomClearPoint(R * 0.45, R * 0.85);
  agent.x = p.x;
  agent.z = p.z;
  agent.vx = 0;
  agent.vz = 0;
  agent.speed = 0;
  agent.strideAcc = strideLen() * 0.5;
  agent.footAlt = 0;
  agent.pause = 0.15 + Math.random() * 0.2;
  agent.path = [];
  pickWalkTarget(agent);
}

function resetWalker() {
  resetWalkerAgent(walk);
  resetWalkerAgent(walkUp);
  syncWalkerVisuals();
}

function syncWalkerVisuals() {
  const gy = walkerGroundY();
  const uy = walkerUpY();
  if (walkerMesh) {
    walkerMesh.position.set(walk.x, gy, walk.z);
    walkerMesh.visible = !!els.walkOn?.checked;
  }
  if (targetMesh) {
    targetMesh.position.set(walk.goalX, gy * 0.35, walk.goalZ);
    targetMesh.visible = !!els.walkOn?.checked;
  }
  if (walkerUpMesh) {
    walkerUpMesh.position.set(walkUp.x, uy, walkUp.z);
    walkerUpMesh.visible = !!els.walkUpOn?.checked;
  }
  if (targetUpMesh) {
    targetUpMesh.position.set(walkUp.goalX, uy + 0.02, walkUp.goalZ);
    targetUpMesh.visible = !!els.walkUpOn?.checked;
  }
  if (walkVoice) walkVoice.setPosition(walk.x, walk.z, { apply: false, y: gy });
  if (walkUpVoice) walkUpVoice.setPosition(walkUp.x, walkUp.z, { apply: false, y: uy });
  updatePathLine();
  updatePathLineUp();
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

async function triggerFootstep(agent, voice, enabled, speedRatio) {
  if (!voice || !enabled || !sceneRunning) return;
  const id = agent.footAlt % 2 === 0 ? "foot1" : "foot2";
  agent.footAlt++;
  const buf = await loadSample(id);
  const src = voice.play(buf, { loop: false });
  if (!src) return;
  // Quieter / darker when creeping in; upstairs slightly darker (structure)
  const upstairs = voice === walkUpVoice;
  const rate = (0.92 + speedRatio * 0.14) * (upstairs ? 0.94 : 1);
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

function updateWalkerAgent(agent, dt, voice, enabled) {
  if (!enabled) return;

  if (agent.pause > 0) {
    agent.pause -= dt;
    agent.speed = 0;
    agent.vx = 0;
    agent.vz = 0;
    if (agent.pause <= 0) pickWalkTarget(agent);
    return;
  }

  const dx = agent.targetX - agent.x;
  const dz = agent.targetZ - agent.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const maxSpd = maxWalkSpeed();
  const toGoal = Math.hypot(agent.goalX - agent.x, agent.goalZ - agent.z);
  const brakingDist = agent.path.length ? Math.max(dist, 1.2) : toGoal;
  const desired = desiredSpeedForDistance(brakingDist, maxSpd);

  const accel = desired >= agent.speed ? 2.8 : 4.2;
  const deltaV = desired - agent.speed;
  const maxStep = accel * dt;
  agent.speed += Math.max(-maxStep, Math.min(maxStep, deltaV));

  const ux = dx / dist;
  const uz = dz / dist;
  agent.vx = ux * agent.speed;
  agent.vz = uz * agent.speed;

  const moved = navStep(agent, agent.vx * dt, agent.vz * dt, NAV_RADIUS * 0.9);
  if (moved < 1e-5 && agent.speed > 0.05) {
    setWalkDestination(agent, agent.goalX, agent.goalZ);
  }

  agent.strideAcc += moved;
  const stride = strideLen() * (0.92 + Math.random() * 0.08);
  const speedRatio = Math.min(1, agent.speed / Math.max(0.2, maxSpd));
  while (agent.strideAcc >= stride) {
    agent.strideAcc -= stride;
    if (agent.speed > 0.12) triggerFootstep(agent, voice, enabled, speedRatio);
  }

  const arriveR = agent.path.length ? 0.38 : 0.2;
  if (dist < arriveR) {
    if (agent.path.length) {
      const next = agent.path.shift();
      agent.targetX = next.x;
      agent.targetZ = next.z;
    } else if (agent.speed < 0.18) {
      agent.x = agent.targetX;
      agent.z = agent.targetZ;
      agent.speed = 0;
      agent.pause = 0.25 + Math.random() * 0.55;
      agent.arriving = true;
    }
  }
}

function updateWalker(dt) {
  updateWalkerAgent(walk, dt, walkVoice, !!els.walkOn?.checked);
  updateWalkerAgent(walkUp, dt, walkUpVoice, !!els.walkUpOn?.checked);
  syncWalkerVisuals();
}

async function playUi(which) {
  if (!uiVoice || !spatReady) return;
  const map = { click: "uiClick", ok: "uiOk", pop: "uiPop" };
  const buf = await loadSample(map[which]);
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
      if (spatReady) spat.refreshRoom();
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

const walkerUpMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 20, 14),
  new THREE.MeshStandardMaterial({
    color: 0xa78bfa,
    emissive: 0x7c3aed,
    emissiveIntensity: 0.85,
  })
);
scene.add(walkerUpMesh);

const targetUpMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.18, 0.28, 32),
  new THREE.MeshBasicMaterial({
    color: 0xc4b5fd,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  })
);
targetUpMesh.rotation.x = -Math.PI / 2;
scene.add(targetUpMesh);

const ambiMeshes = AMBI_WORLD.map(() => {
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

const pathLineUp = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.55 })
);
scene.add(pathLineUp);

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
  push(walkVoice, walk.x, walk.z, walkerGroundY(), "walk", "walker");
  push(walkUpVoice, walkUp.x, walkUp.z, walkerUpY(), "walk↑", "walker-up");
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
    ["walker", "Walker (ground)"],
    ["walker-up", "Walker (upstairs)"],
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
    setLineEndpoints(line, listener.x, listenerEarY(), listener.z, s.x, s.y, s.z);

    const drySum = v.lastDrySum || 0;
    const reflSum = v.lastReflSum || 0;
    const wet = v.lastWet || 0;
    const midX = (listener.x + s.x) * 0.5;
    const midZ = (listener.z + s.z) * 0.5;
    const midY = 0.95 + s.y * 0.25;
    const elevTxt =
      v.lastElev != null ? ` · elev ${v.lastElev >= 0 ? "+" : ""}${(v.lastElev * 90).toFixed(0)}°` : "";
    const floorTxt =
      v.lastFloorOcc > 0.02 ? ` · floor ${pct01(v.lastFloorOcc)}` : "";
    const directText =
      `${s.label} · dry ${pct01(v.lastDryMul ?? 1)} · occ ${pct01(occ)}` +
      `${floorTxt}${elevTxt} · refl ${reflSum.toFixed(2)} · wet ${wet.toFixed(2)}`;
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

function fillAgentPathLine(line, agent, y, visible) {
  if (!line) return;
  line.visible = !!visible;
  if (!visible) return;
  const pts = [new THREE.Vector3(agent.x, y, agent.z)];
  if (
    Math.hypot(agent.targetX - agent.x, agent.targetZ - agent.z) > 0.05 ||
    agent.path.length
  ) {
    pts.push(new THREE.Vector3(agent.targetX, y, agent.targetZ));
  }
  for (const p of agent.path) {
    pts.push(new THREE.Vector3(p.x, y, p.z));
  }
  if (pts.length === 1) {
    pts.push(new THREE.Vector3(agent.goalX, y, agent.goalZ));
  }
  line.geometry.setFromPoints(pts);
}

function updatePathLine() {
  fillAgentPathLine(pathLine, walk, walkerGroundY() + 0.04, !!els.walkOn?.checked);
}

function updatePathLineUp() {
  fillAgentPathLine(pathLineUp, walkUp, walkerUpY() + 0.04, !!els.walkUpOn?.checked);
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
  if (els.walkUpVolOut) els.walkUpVolOut.textContent = `${els.walkUpVol?.value ?? 50}%`;
  if (els.floorHeightOut) {
    els.floorHeightOut.textContent = `${floorDeckY().toFixed(1)} m`;
  }
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
  await spat.ensureContext();
  spatReady = true;
  // Bust flap cache so soft wing wavs replace any old samples
  spat.clearBuffer(SAMPLE_URLS.flap1);
  spat.clearBuffer(SAMPLE_URLS.flap2);
  syncSpatFromUI();
  rebuildBus();
  bumpSpatSettle(6);

  for (const id of Object.keys(SAMPLE_URLS)) {
    loadSample(id).catch(() => {});
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
  if (!spatReady || !spat.ctx) {
    await enableAudio();
  } else if (spat.ctx.state === "suspended") {
    await spat.ctx.resume();
  }
  syncSpatFromUI();
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
  setStatus(spatReady ? "Stopped" : "Audio off");
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
  const ctxState = (spat.ctx?.state || "off").padEnd(9, " ");
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
  if (perf.frameMs > 28 || perf.spatMs > 12 || (spat.ctx && spat.ctx.state !== "running")) {
    el.classList.add(perf.frameMs > 40 || (spat.ctx && spat.ctx.state !== "running") ? "bad" : "warn");
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
    spatReady &&
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
  tintSourceBehind(walkerUpMesh, walkUp.x, walkUp.z);
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
  if (spat.ctx && spat.ctx.state === "suspended" && sceneRunning) {
    spat.ctx.resume().catch(() => {});
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
  if (spatReady) {
    const was = sceneRunning;
    stopScene();
    syncSpatFromUI();
  rebuildBus();
    if (was) startScene();
  } else rebuildSpeakerVisuals();
});

for (const el of [
  els.ambiVol,
  els.ambiDrift,
  els.walkVol,
  els.walkUpVol,
  els.walkSpeed,
  els.walkStride,
  els.walkRadius,
  els.uiVol,
]) {
  el?.addEventListener("input", () => {
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
els.walkOn.addEventListener("change", () => {
  syncLevels();
  syncWalkerVisuals();
});
els.walkUpOn?.addEventListener("change", () => {
  syncLevels();
  syncWalkerVisuals();
  if (els.walkUpOn.checked && sceneRunning) {
    pickWalkTarget(walkUp);
  }
});

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
  if (spatReady) rebuildBirdAgents();
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
    if (birdVoices[i]) {
      birdVoices[i].setPosition(x, z, { apply: false, y: birds[i]?.y ?? 1.2 });
    }
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
  if (id === "listener" && spatReady) {
    // Refresh room early-reflection VBAP directions for new listener seat
    spat.refreshRoom();
    bumpSpatSettle(12);
  } else if (spatReady && (id === "waterfall" || id?.startsWith("bird-"))) {
    bumpSpatSettle(8);
  }
  // Walls moved — refresh routes around new geometry
  if (
    id?.startsWith("wall") ||
    dragTarget.userData?.kind === "wall" ||
    dragTarget.userData?.kind === "wall-handle"
  ) {
    setWalkDestination(walk, walk.goalX, walk.goalZ);
    setWalkDestination(walkUp, walkUp.goalX, walkUp.goalZ);
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
  syncSpatFromUI();
  spat.applyAll();
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
els.floorOcc?.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(18);
});
els.floorHeight?.addEventListener("input", () => {
  updateLabels();
  syncWalkerVisuals();
  if (walkUpVoice) walkUpVoice.y = walkerUpY();
  refreshAcoustics();
  bumpSpatSettle(10);
});
els.frontBack?.addEventListener("change", () => {
  refreshAcoustics();
  bumpSpatSettle(12);
});

els.roomOn.addEventListener("change", () => {
  spat.refreshRoom();
});
for (const el of [els.roomSize, els.roomHeight, els.roomAbs, els.roomWet]) {
  el.addEventListener("input", () => {
    spat.refreshRoom();
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

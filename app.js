/**
 * Surround Tester — discrete multichannel output via Web Audio.
 * Firefox-safe: sets destination.channelCount + discrete interpretation,
 * then routes mono sources through ChannelMerger inputs.
 */

const LAYOUTS = {
  stereo: {
    label: "Stereo (2.0)",
    channels: 2,
    speakers: [
      { id: "FL", name: "Front Left", ch: 0, x: 18, y: 18 },
      { id: "FR", name: "Front Right", ch: 1, x: 82, y: 18 },
    ],
  },
  quad: {
    label: "Quad (4.0)",
    channels: 4,
    speakers: [
      { id: "FL", name: "Front Left", ch: 0, x: 18, y: 18 },
      { id: "FR", name: "Front Right", ch: 1, x: 82, y: 18 },
      { id: "BL", name: "Back Left", ch: 2, x: 18, y: 82 },
      { id: "BR", name: "Back Right", ch: 3, x: 82, y: 82 },
    ],
  },
  "51": {
    label: "5.1",
    channels: 6,
    speakers: [
      { id: "FL", name: "Front Left", ch: 0, x: 18, y: 16 },
      { id: "FC", name: "Center", ch: 2, x: 50, y: 12 },
      { id: "FR", name: "Front Right", ch: 1, x: 82, y: 16 },
      { id: "LFE", name: "LFE / Sub", ch: 3, x: 50, y: 34 },
      { id: "SL", name: "Surround Left", ch: 4, x: 14, y: 78 },
      { id: "SR", name: "Surround Right", ch: 5, x: 86, y: 78 },
    ],
  },
  "71": {
    label: "7.1",
    channels: 8,
    speakers: [
      { id: "FL", name: "Front Left", ch: 0, x: 18, y: 16 },
      { id: "FC", name: "Center", ch: 2, x: 50, y: 12 },
      { id: "FR", name: "Front Right", ch: 1, x: 82, y: 16 },
      { id: "LFE", name: "LFE / Sub", ch: 3, x: 50, y: 34 },
      { id: "SL", name: "Side Left", ch: 6, x: 10, y: 52 },
      { id: "SR", name: "Side Right", ch: 7, x: 90, y: 52 },
      { id: "BL", name: "Back Left", ch: 4, x: 18, y: 84 },
      { id: "BR", name: "Back Right", ch: 5, x: 82, y: 84 },
    ],
  },
};

const els = {
  room: document.getElementById("room"),
  layout: document.getElementById("layout"),
  signal: document.getElementById("signal"),
  volume: document.getElementById("volume"),
  volumeOut: document.getElementById("volume-out"),
  hold: document.getElementById("hold"),
  holdOut: document.getElementById("hold-out"),
  btnStart: document.getElementById("btn-start"),
  btnSweep: document.getElementById("btn-sweep"),
  btnStop: document.getElementById("btn-stop"),
  maxChannels: document.getElementById("max-channels"),
  activeChannels: document.getElementById("active-channels"),
  playingLabel: document.getElementById("playing-label"),
  compatNote: document.getElementById("compat-note"),
  hint: document.getElementById("hint"),
};

/** @type {AudioContext | null} */
let ctx = null;
/** @type {ChannelMergerNode | null} */
let merger = null;
/** @type {Array<GainNode>} */
let channelGains = [];
/** @type {AudioNode | null} */
let activeSource = null;
/** @type {number | null} */
let stopTimer = null;
/** @type {AbortController | null} */
let sweepAbort = null;
let currentLayoutKey = "51";
let audioReady = false;
let soloChannel = -1;
let deviceMaxChannels = 0;
let activeOutputChannels = 0;

function holdSeconds() {
  return Number(els.hold.value) / 10;
}

function volumeGain() {
  const pct = Number(els.volume.value) / 100;
  return pct * pct;
}

function updateOutputs() {
  els.volumeOut.textContent = `${els.volume.value}%`;
  els.holdOut.textContent = `${holdSeconds().toFixed(1)}s`;
}

function setPlaying(text) {
  els.playingLabel.textContent = text;
}

function clearActiveSpeakers() {
  els.room.querySelectorAll(".speaker.active").forEach((el) => {
    el.classList.remove("active");
  });
}

function markSpeakerActive(channelIndex) {
  clearActiveSpeakers();
  const btn = els.room.querySelector(`[data-ch="${channelIndex}"]`);
  if (btn) btn.classList.add("active");
}

function applyChannelLevels() {
  const vol = volumeGain();
  for (let i = 0; i < channelGains.length; i++) {
    channelGains[i].gain.value = i === soloChannel ? vol : 0;
  }
}

/** Stop audio only. Pass abortSweep:true for Stop button / new manual play. */
function stopPlayback({ abortSweep = false } = {}) {
  if (stopTimer != null) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (abortSweep && sweepAbort) {
    sweepAbort.abort();
    sweepAbort = null;
  }
  if (activeSource) {
    try {
      if ("stop" in activeSource) activeSource.stop();
      activeSource.disconnect();
    } catch {
      /* already stopped */
    }
    activeSource = null;
  }
  soloChannel = -1;
  applyChannelLevels();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  clearActiveSpeakers();
  setPlaying("idle");
}

function stopSound() {
  stopPlayback({ abortSweep: true });
}

function renderRoom() {
  const layout = LAYOUTS[currentLayoutKey];
  els.room.replaceChildren();

  for (const sp of layout.speakers) {
    const available = audioReady && sp.ch < channelGains.length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "speaker" + (audioReady && !available ? " unavailable" : "");
    btn.style.left = `${sp.x}%`;
    btn.style.top = `${sp.y}%`;
    btn.dataset.ch = String(sp.ch);
    btn.disabled = !audioReady;
    btn.setAttribute(
      "aria-label",
      available
        ? `Test ${sp.name}, channel ${sp.ch}`
        : `${sp.name} unavailable on this device`
    );
    btn.innerHTML = `
      <span class="speaker-body" aria-hidden="true"></span>
      <span class="speaker-label">${sp.id}</span>
      <span class="speaker-ch">ch ${sp.ch}</span>
    `;
    btn.addEventListener("click", () => playChannel(sp));
    els.room.appendChild(btn);
  }
}

/**
 * Read and optionally exercise destination channel counts.
 * Firefox reports maxChannelCount from the current OS sink.
 */
function readCapabilities() {
  if (!ctx) {
    deviceMaxChannels = 0;
    activeOutputChannels = 0;
    return { max: 0, current: 0, sampleRate: 0, supported: [] };
  }
  const dest = ctx.destination;
  const max = dest.maxChannelCount || 0;
  deviceMaxChannels = max;

  const supported = [];
  for (const n of [1, 2, 4, 6, 8]) {
    if (max > 0 && n > max) break;
    try {
      dest.channelCount = n;
      dest.channelCountMode = "explicit";
      dest.channelInterpretation = "discrete";
      supported.push(dest.channelCount);
    } catch {
      /* not supported */
    }
  }

  return {
    max,
    current: dest.channelCount,
    sampleRate: ctx.sampleRate,
    state: ctx.state,
    baseLatency: ctx.baseLatency,
    supported: [...new Set(supported)],
  };
}

function updateCapabilityUI(caps, requestedN, activeN) {
  els.maxChannels.textContent = caps.max ? `${caps.max} ch` : "unknown";
  els.activeChannels.textContent = activeN
    ? `${activeN} ch`
    : caps.current
      ? `${caps.current} ch`
      : "—";

  const bits = [
    `sampleRate ${Math.round(caps.sampleRate)} Hz`,
    `state ${caps.state || "?"}`,
  ];
  if (caps.supported?.length) {
    bits.push(`settable ${caps.supported.join("/")}`);
  }

  if (!caps.max) {
    els.compatNote.textContent =
      "Could not read maxChannelCount. Enable audio first, or check that Web Audio is allowed.";
    return;
  }
  if (caps.max <= 2) {
    els.compatNote.textContent =
      `Device reports ${caps.max} output channels (stereo). ` +
      `Firefox mirrors the current OS/PipeWire sink — switch to a 5.1/7.1 sink, then click Enable audio again. ` +
      `(${bits.join(" · ")})`;
    return;
  }
  if (activeN < requestedN) {
    els.compatNote.textContent =
      `Layout wants ${requestedN}ch; using ${activeN}ch (device max ${caps.max}). ` +
      `(${bits.join(" · ")})`;
    return;
  }
  els.compatNote.textContent =
    `Discrete ${activeN}-channel output active (device max ${caps.max}). ` +
    `(${bits.join(" · ")})`;
}

function configureDestination(channelCount) {
  if (!ctx) return 2;
  const dest = ctx.destination;
  const caps = readCapabilities();
  const max = caps.max || 2;
  const n = Math.min(channelCount, max);
  try {
    dest.channelCount = n;
    dest.channelCountMode = "explicit";
    dest.channelInterpretation = "discrete";
  } catch (err) {
    console.warn("Could not set destination channelCount:", err);
  }
  activeOutputChannels = dest.channelCount;
  return activeOutputChannels;
}

function rebuildGraph() {
  if (!ctx) return;

  stopPlayback({ abortSweep: true });

  if (merger) {
    try {
      merger.disconnect();
    } catch {
      /* noop */
    }
  }

  const layout = LAYOUTS[currentLayoutKey];
  // Read caps first (also probes settable counts), then lock destination to layout size.
  const caps = readCapabilities();
  const n = configureDestination(layout.channels);

  merger = ctx.createChannelMerger(n);
  merger.channelInterpretation = "discrete";

  channelGains = [];
  for (let i = 0; i < n; i++) {
    const g = ctx.createGain();
    g.channelCount = 1;
    g.channelCountMode = "explicit";
    g.gain.value = 0;
    g.connect(merger, 0, i);
    channelGains.push(g);
  }

  merger.connect(ctx.destination);
  updateCapabilityUI(caps, layout.channels, n);
}

async function enableAudio() {
  // Recreate context on each enable/re-detect so Firefox re-reads the OS sink
  // (maxChannelCount is tied to the device that was current when the context opened).
  if (ctx) {
    stopPlayback({ abortSweep: true });
    try {
      await ctx.close();
    } catch {
      /* noop */
    }
    ctx = null;
    merger = null;
    channelGains = [];
  }

  ctx = new AudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  // Brief settle — some backends publish maxChannelCount only after running.
  await new Promise((r) => setTimeout(r, 80));

  audioReady = true;
  els.btnStart.textContent = "Re-detect";
  els.btnStart.disabled = false;
  els.btnSweep.disabled = false;
  els.btnStop.disabled = false;
  rebuildGraph();
  renderRoom();
  els.hint.textContent = "Tap a speaker to send signal to that channel only.";
}

function createNoiseBuffer(kind) {
  if (!ctx) throw new Error("no context");
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (kind === "white") {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

function connectMonoToChannel(source, channelIndex) {
  const gain = channelGains[channelIndex];
  if (!gain) {
    throw new Error(`Channel ${channelIndex} not available on this device/layout`);
  }
  soloChannel = channelIndex;
  applyChannelLevels();
  source.connect(gain);
}

function scheduleAutoStop(durationSec) {
  if (stopTimer != null) clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    // Soft stop — do not kill an in-progress sweep
    stopPlayback({ abortSweep: false });
  }, durationSec * 1000);
}

function playTone(channelIndex, duration) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = channelIndex === 3 ? 60 : 1000;
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(env);
  connectMonoToChannel(env, channelIndex);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
  activeSource = osc;
}

function playFreqSweep(channelIndex, duration) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  const startF = channelIndex === 3 ? 30 : 200;
  const endF = channelIndex === 3 ? 120 : 4000;
  osc.frequency.setValueAtTime(startF, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endF, ctx.currentTime + duration);
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(env);
  connectMonoToChannel(env, channelIndex);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
  activeSource = osc;
}

function playNoise(channelIndex, duration, kind) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = createNoiseBuffer(kind);
  src.loop = true;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.04);
  env.gain.setValueAtTime(0.55, ctx.currentTime + Math.max(0.05, duration - 0.08));
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(env);
  connectMonoToChannel(env, channelIndex);
  src.start();
  src.stop(ctx.currentTime + duration + 0.02);
  activeSource = src;
}

function playVoice(speaker) {
  if (!window.speechSynthesis) {
    playNoise(speaker.ch, holdSeconds(), "pink");
    return;
  }
  playTone(speaker.ch, Math.min(0.35, holdSeconds()));
  const utter = new SpeechSynthesisUtterance(speaker.name);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

/**
 * @param {object} speaker
 * @param {{ fromSweep?: boolean }} [opts]
 */
function playChannel(speaker, opts = {}) {
  const fromSweep = Boolean(opts.fromSweep);
  if (!audioReady || !ctx) return;
  if (speaker.ch >= channelGains.length) {
    setPlaying(`${speaker.id} unavailable`);
    els.compatNote.textContent =
      `Channel ${speaker.ch} (${speaker.name}) needs more than ` +
      `${channelGains.length} output channels (device max ${deviceMaxChannels || ctx.destination.maxChannelCount}).`;
    return;
  }

  // Manual click cancels sweep; sweep itself must not.
  stopPlayback({ abortSweep: !fromSweep });

  const duration = holdSeconds();
  const signal = els.signal.value;
  markSpeakerActive(speaker.ch);
  setPlaying(`${speaker.id} · ch ${speaker.ch}`);

  if (signal === "voice") {
    playVoice(speaker);
    if (!fromSweep) scheduleAutoStop(Math.max(duration, 1.6));
    return;
  }
  if (signal === "tone") {
    playTone(speaker.ch, duration);
  } else if (signal === "sweep") {
    playFreqSweep(speaker.ch, duration);
  } else if (signal === "white") {
    playNoise(speaker.ch, duration, "white");
  } else {
    playNoise(speaker.ch, duration, "pink");
  }
  if (!fromSweep) scheduleAutoStop(duration + 0.05);
}

async function sweepAll() {
  if (!audioReady) return;
  stopPlayback({ abortSweep: true });
  const layout = LAYOUTS[currentLayoutKey];
  const controller = new AbortController();
  sweepAbort = controller;
  els.btnSweep.disabled = true;

  try {
    for (const sp of layout.speakers) {
      if (controller.signal.aborted) break;
      if (sp.ch >= channelGains.length) continue;
      playChannel(sp, { fromSweep: true });
      const wait =
        els.signal.value === "voice"
          ? Math.max(holdSeconds(), 1.6) * 1000
          : (holdSeconds() + 0.2) * 1000;
      await sleep(wait, controller.signal);
      if (controller.signal.aborted) break;
      stopPlayback({ abortSweep: false });
    }
  } finally {
    if (sweepAbort === controller) sweepAbort = null;
    els.btnSweep.disabled = !audioReady;
    if (!controller.signal.aborted) {
      stopPlayback({ abortSweep: false });
      setPlaying("sweep done");
    }
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  }).catch((err) => {
    if (err?.name === "AbortError") return;
    throw err;
  });
}

function probe() {
  try {
    const probeCtx = new AudioContext();
    const max = probeCtx.destination.maxChannelCount;
    els.maxChannels.textContent = max ? `${max} ch` : "—";
    els.activeChannels.textContent = `${probeCtx.destination.channelCount} ch`;
    els.compatNote.textContent =
      max
        ? `Pre-start probe: maxChannelCount=${max}, default channelCount=${probeCtx.destination.channelCount}. Click Enable audio to open the real graph (and re-read after resume).`
        : "Pre-start probe could not read channel count. Click Enable audio.";
    probeCtx.close();
  } catch {
    els.compatNote.textContent = "Web Audio unavailable in this browser.";
  }
}

els.btnStart.addEventListener("click", () => {
  enableAudio().catch((err) => {
    console.error(err);
    els.compatNote.textContent = `Failed to start audio: ${err.message}`;
  });
});

els.btnStop.addEventListener("click", () => stopSound());
els.btnSweep.addEventListener("click", () => {
  sweepAll().catch(() => {
    /* aborted */
  });
});

els.layout.addEventListener("change", () => {
  currentLayoutKey = els.layout.value;
  if (audioReady) rebuildGraph();
  renderRoom();
});

els.volume.addEventListener("input", () => {
  updateOutputs();
  applyChannelLevels();
});

els.hold.addEventListener("input", updateOutputs);

updateOutputs();
renderRoom();
probe();

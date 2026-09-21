type Bus = { ctx: AudioContext; master: GainNode; sfx: GainNode; music: GainNode };

let bus: Bus | null = null;
let muted = false;
let noise: AudioBuffer | null = null;
let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmLoading = false;

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  if (!bus) {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    sfx.gain.value = 0.62;
    music.gain.value = 0.28;
    master.gain.value = muted ? 0 : 0.78;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    bus = { ctx, master, sfx, music };
    noise = makeNoise(ctx);
    void loadBgm();
  }
  if (bus.ctx.state === "suspended") void bus.ctx.resume();
}

export function setMuted(next: boolean) {
  muted = next;
  if (bus) bus.master.gain.setTargetAtTime(next ? 0 : 0.78, bus.ctx.currentTime, 0.03);
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function resumeAudio() {
  if (bus?.ctx.state === "suspended") void bus.ctx.resume();
  if (bus && bgmBuffer && !bgmSource) startBgm();
}

let bgmRaw: ArrayBuffer | null = null;

export async function preloadAssets() {
  if (bgmRaw || bgmBuffer) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 400);
  try {
    const res = await fetch("/audio/moonlit-window.ogg", { signal: ctrl.signal, cache: "force-cache" });
    if (res.ok) {
      bgmRaw = await res.arrayBuffer();
      return;
    }
  } catch {
    /* fall through */
  } finally {
    clearTimeout(timer);
  }
  try {
    const res = await fetch("/audio/moonlit-window.mp3", { cache: "force-cache" });
    if (res.ok) bgmRaw = await res.arrayBuffer();
  } catch {
    /* sfx still work */
  }
}

async function loadBgm() {
  if (!bus || bgmLoading || bgmBuffer) {
    if (bus && bgmBuffer && !bgmSource) startBgm();
    return;
  }
  bgmLoading = true;
  try {
    if (!bgmRaw) await preloadAssets();
    if (bgmRaw) {
      bgmBuffer = await bus.ctx.decodeAudioData(bgmRaw.slice(0));
      startBgm();
    }
  } catch {
    /* sfx still work */
  }
  bgmLoading = false;
}

function startBgm() {
  if (!bus || !bgmBuffer) return;
  if (bgmSource) {
    try {
      bgmSource.stop();
    } catch {
      /* already stopped */
    }
    bgmSource.disconnect();
  }
  const src = bus.ctx.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bus.music);
  src.start();
  bgmSource = src;
}

function makeNoise(ctx: AudioContext) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx: AudioContext, g: GainNode, t: number, a: number, d: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.004, a));
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, a = 0.006, slide = 0) {
  if (!bus) return;
  const { ctx, sfx } = bus;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + a + dur);
  env(ctx, g, t, a, dur, peak);
  osc.connect(g);
  g.connect(sfx);
  osc.start(t);
  osc.stop(t + a + dur + 0.03);
}

function burst(dur: number, peak: number, hp = 800, lp = 2400) {
  if (!bus || !noise) return;
  const { ctx, sfx } = bus;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = hp;
  f.Q.value = 0.85;
  const f2 = ctx.createBiquadFilter();
  f2.type = "lowpass";
  f2.frequency.value = lp;
  const g = ctx.createGain();
  env(ctx, g, t, 0.003, dur, peak);
  src.connect(f);
  f.connect(f2);
  f2.connect(g);
  g.connect(sfx);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function duck(amount: number, recover: number) {
  if (!bus) return;
  const t = bus.ctx.currentTime;
  bus.music.gain.cancelScheduledValues(t);
  bus.music.gain.setValueAtTime(bus.music.gain.value, t);
  bus.music.gain.linearRampToValueAtTime(Math.max(0.08, 0.28 - amount), t + 0.04);
  bus.music.gain.linearRampToValueAtTime(0.28, t + recover);
}

export function sfx(name: string) {
  if (!bus || muted) return;
  const rate = 1 + (Math.random() * 2 - 1) * 0.07;
  switch (name) {
    case "click":
      tone(980 * rate, 0.04, "square", 0.07);
      burst(0.03, 0.06, 1800, 4000);
      break;
    case "buy":
      tone(784 * rate, 0.07, "triangle", 0.12);
      tone(1175 * rate, 0.1, "sine", 0.08);
      break;
    case "place":
      burst(0.09, 0.18, 360, 1400);
      tone(196, 0.12, "sine", 0.12);
      tone(392 * rate, 0.08, "triangle", 0.06);
      break;
    case "bolt":
      burst(0.05, 0.16, 1400, 4200);
      tone(520 * rate, 0.05, "square", 0.08, 0.002, 1.8);
      tone(180, 0.06, "sine", 0.07);
      break;
    case "axe":
      burst(0.11, 0.28, 220, 1600);
      tone(90 * rate, 0.12, "sine", 0.2, 0.004, 0.45);
      tone(240 * rate, 0.07, "square", 0.08, 0.002, 0.6);
      break;
    case "frenzy":
      burst(0.16, 0.22, 180, 900);
      tone(110 * rate, 0.16, "sine", 0.22, 0.006, 0.4);
      tone(220 * rate, 0.12, "triangle", 0.12, 0.01, 0.7);
      tone(330 * rate, 0.1, "square", 0.07, 0.02, 0.55);
      break;
    case "laser":
      tone(1680 * rate, 0.07, "sawtooth", 0.06, 0.002, 0.45);
      tone(880 * rate, 0.05, "square", 0.04);
      burst(0.04, 0.08, 2000, 5000);
      break;
    case "mortar":
      burst(0.08, 0.12, 180, 700);
      tone(70, 0.1, "sine", 0.1);
      break;
    case "boom":
      burst(0.28, 0.42, 140, 900);
      burst(0.12, 0.22, 900, 2800);
      tone(58, 0.28, "sine", 0.28, 0.004, 0.35);
      tone(140 * rate, 0.1, "triangle", 0.1, 0.003, 0.5);
      duck(0.14, 0.45);
      break;
    case "magic":
      tone(420 * rate, 0.22, "triangle", 0.14, 0.02, 1.7);
      tone(840 * rate, 0.18, "sine", 0.1, 0.03, 1.4);
      burst(0.2, 0.16, 700, 2400);
      break;
    case "shaman":
      tone(196 * rate, 0.28, "sine", 0.1, 0.04);
      tone(294 * rate, 0.32, "triangle", 0.08, 0.05);
      tone(392 * rate, 0.24, "sine", 0.05, 0.08);
      burst(0.18, 0.08, 500, 1600);
      break;
    case "hit":
      burst(0.035, 0.14, 1200, 3600);
      tone(310 * rate, 0.04, "square", 0.06, 0.002, 0.7);
      break;
    case "death":
      burst(0.16, 0.24, 280, 1600);
      tone(140 * rate, 0.14, "triangle", 0.12, 0.004, 0.5);
      tone(90, 0.18, "sine", 0.1);
      break;
    case "leak":
      tone(98, 0.28, "sine", 0.18, 0.01, 0.7);
      burst(0.22, 0.2, 120, 480);
      break;
    case "merge":
      tone(392, 0.1, "triangle", 0.12);
      tone(494, 0.12, "triangle", 0.1);
      tone(587, 0.18, "triangle", 0.13);
      burst(0.08, 0.08, 800, 2000);
      break;
    case "wave":
      tone(196, 0.2, "sine", 0.1);
      tone(247, 0.26, "sine", 0.08);
      burst(0.1, 0.06, 400, 1200);
      break;
    case "win":
      tone(392, 0.16, "triangle", 0.12);
      tone(523, 0.2, "triangle", 0.12);
      tone(659, 0.3, "triangle", 0.14);
      break;
    case "lose":
      tone(196, 0.32, "sine", 0.14, 0.02, 0.75);
      tone(147, 0.42, "sine", 0.12, 0.04, 0.7);
      break;
    case "deny":
      tone(130, 0.08, "square", 0.08);
      burst(0.04, 0.06, 200, 600);
      break;
    default:
      break;
  }
}

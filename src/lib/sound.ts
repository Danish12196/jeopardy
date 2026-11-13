import type { SoundEvent, SoundSettings } from "./pbTypes";

const LOCAL_PREFS_KEY = "lockout:soundPrefs";

export const ALL_SOUND_EVENTS: SoundEvent[] = [
  "buzz",
  "correct",
  "wrong",
  "timerEnd",
  "allInReveal",
  "wildcard",
];

export const DEFAULT_SOUND_SETTINGS: Required<SoundSettings> = {
  muted: false,
  volume: 0.7,
  enabledEvents: {
    buzz: true,
    correct: true,
    wrong: true,
    timerEnd: true,
    allInReveal: true,
    wildcard: true,
  },
  customUrls: {},
};

export function normalizeSoundSettings(sound?: SoundSettings | null): Required<SoundSettings> {
  const rawVol = Number(sound?.volume);
  const volume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0, rawVol)) : DEFAULT_SOUND_SETTINGS.volume;
  const enabledEvents: Partial<Record<SoundEvent, boolean>> = {};
  for (const evt of ALL_SOUND_EVENTS) {
    enabledEvents[evt] = sound?.enabledEvents?.[evt] ?? true;
  }
  const customUrls: Partial<Record<SoundEvent, string>> = {};
  if (sound?.customUrls) {
    for (const evt of ALL_SOUND_EVENTS) {
      const u = sound.customUrls[evt]?.trim();
      if (u) customUrls[evt] = u;
    }
  }
  return {
    muted: Boolean(sound?.muted),
    volume,
    enabledEvents,
    customUrls,
  };
}

export function loadLocalSoundPrefs(): Partial<Pick<SoundSettings, "muted" | "volume">> {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    const out: Partial<Pick<SoundSettings, "muted" | "volume">> = {};
    if (typeof parsed.muted === "boolean") out.muted = parsed.muted;
    if (typeof parsed.volume === "number" && Number.isFinite(parsed.volume)) {
      out.volume = Math.min(1, Math.max(0, parsed.volume));
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLocalSoundPrefs(prefs: Partial<Pick<SoundSettings, "muted" | "volume">>): void {
  try {
    const prev = loadLocalSoundPrefs();
    localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify({ ...prev, ...prefs }));
  } catch {
    // storage unavailable
  }
}

type ToneSpec = {
  type: OscillatorType;
  startFreq: number;
  endFreq: number;
  duration: number;
};

const TONES: Record<SoundEvent, ToneSpec> = {
  buzz: { type: "triangle", startFreq: 523.25, endFreq: 659.25, duration: 0.25 },
  correct: { type: "sine", startFreq: 523.25, endFreq: 783.99, duration: 0.3 },
  wrong: { type: "sawtooth", startFreq: 220, endFreq: 130.81, duration: 0.35 },
  timerEnd: { type: "square", startFreq: 440, endFreq: 220, duration: 0.45 },
  allInReveal: { type: "triangle", startFreq: 392, endFreq: 784, duration: 0.4 },
  wildcard: { type: "sine", startFreq: 440, endFreq: 880, duration: 0.35 },
};

export function playSound(event: SoundEvent, settings?: SoundSettings | null): boolean {
  const s = normalizeSoundSettings(settings);
  if (s.muted || s.volume <= 0 || s.enabledEvents[event] === false) {
    return false;
  }

  const customUrl = s.customUrls[event];
  if (customUrl && typeof Audio !== "undefined") {
    try {
      const audio = new Audio(customUrl);
      audio.volume = s.volume;
      audio.play().catch(() => {});
      return true;
    } catch {
      // fall back to Web Audio
    }
  }

  try {
    if (typeof window === "undefined") return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const spec = TONES[event];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(spec.endFreq, ctx.currentTime + Math.min(0.12, spec.duration));
    gain.gain.setValueAtTime(0.25 * s.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + spec.duration);
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
    return true;
  } catch {
    return false;
  }
}

export function playBuzzerTone(settings?: SoundSettings | null) {
  return playSound("buzz", settings);
}

// ══════════════════ MOTEUR AUDIO 8-BIT & RETOURS HAPTIQUES ══════════════════
// Synthétiseur rétro natif basé sur Web Audio API (zéro dépendance externe).
// Conçu pour le terrain et les brocantes : signalement instantané des pépites,
// avertissement des doublons et alertes discrètes.

export const SOUND_STORE = "insertcoin.sound_enabled";

export function isSoundEnabled() {
  try {
    const val = localStorage.getItem(SOUND_STORE);
    return val === null ? true : val === "true";
  } catch (e) {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_STORE, enabled ? "true" : "false");
  } catch (e) {}
}

let audioCtx = null;

function getAudioContext() {
  if (!isSoundEnabled()) return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

// Bip Pièce Arcade (Coin) : célèbre double saut de fréquence 8-bit (B5 -> E6)
export function playCoinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Fréquence B5 (987.77 Hz) puis saut à E6 (1318.51 Hz)
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {}
}

// Double tonalité d'avertissement rétro (Alerte Doublon en collection)
export function playWarningSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(390, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.29);
  } catch (e) {}
}

// Buzz grave discret si non rentable
export function playBuzzerSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.18);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.21);
  } catch (e) {}
}

// Clic neutre pour interaction
export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

// Vibrations haptiques distinctes
export function vibCoin() {
  if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
}

export function vibWarn() {
  if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
}

export function vibLow() {
  if (navigator.vibrate) navigator.vibrate(30);
}

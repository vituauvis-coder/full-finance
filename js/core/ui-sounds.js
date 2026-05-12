/**
 * Feedback sonoro curto: save ao guardar/pagar; delete ao apagar.
 *
 * Ficheiros em `public/sounds/` (URL `/sounds/…`):
 *   - `delete.mp3` — apagar (substituível; use licença adequada).
 *   - `save.mp3` — guardar / pagar (opcional; há fallback sintético se falhar).
 */

const STORAGE_KEY = 'fullfinan-ui-sounds';
const VOLUME = 0.4;
const DELETE_SOUND_URL = '/sounds/delete.mp3';
const SAVE_SOUND_URL = '/sounds/save.mp3';

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** @returns {boolean} */
export function isUiSoundEnabled() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === null || v === '') return true;
        return v === '1';
    } catch {
        return true;
    }
}

/** @param {boolean} on */
export function setUiSoundEnabled(on) {
    try {
        localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
        /* ignore */
    }
}

function canPlay() {
    return isUiSoundEnabled() && !prefersReducedMotion();
}

/**
 * @param {string} url
 * @returns {Promise<void>}
 */
function playUrl(url) {
    const a = new Audio(url);
    a.volume = VOLUME;
    return a.play().then(() => undefined);
}

function getAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    return Ctx ? new Ctx() : null;
}

function playPingOsc() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(523.25, t0 + 0.1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
    setTimeout(() => {
        ctx.close().catch(() => {});
    }, 450);
}

/** Som de guardar/pagar (`save.mp3`; fallback Web Audio). */
export function playPingSound() {
    if (!canPlay()) return;
    playUrl(SAVE_SOUND_URL).catch(() => {
        try {
            playPingOsc();
        } catch {
            /* ignore */
        }
    });
}

function playTrashNoise() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const dur = 0.14;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
    src.onended = () => {
        ctx.close().catch(() => {});
    };
}

/** Som de apagar (`delete.mp3`; fallback ruído filtrado curto). */
export function playTrashSound() {
    if (!canPlay()) return;
    playUrl(DELETE_SOUND_URL).catch(() => {
        try {
            playTrashNoise();
        } catch {
            /* ignore */
        }
    });
}

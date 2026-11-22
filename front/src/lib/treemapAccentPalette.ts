import { DEFAULT_SCREEN_ACCENTS, mixHex } from '@motor/dinheiro/screen-accent-colors.js';
import { INCOME_TREEMAP_PALETTE } from './treemapData';
import { PROFILE_UPDATED_EVENT } from './profileEvents';
import { useEffect, useMemo, useState } from 'react';

function readCssHexVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
}

/** Tons da família `--gains-accent` (perfil) para tiles distintos do mapa de entradas. */
export function buildGainsTreemapPalette(): string[] {
    const accent = readCssHexVar('--gains-accent', DEFAULT_SCREEN_ACCENTS.gains);
    const strong = readCssHexVar('--gains-accent-strong', mixHex(accent, '#0f172a', 0.14));
    const soft = readCssHexVar('--gains-accent-soft', mixHex(accent, '#ffffff', 0.52));

    const picks = [
        accent,
        strong,
        mixHex(accent, '#0f172a', 0.22),
        mixHex(accent, '#0f172a', 0.32),
        mixHex(accent, '#0f172a', 0.4),
        mixHex(accent, '#0f172a', 0.48),
        mixHex(accent, '#0f172a', 0.55),
        mixHex(accent, '#ffffff', 0.22),
        mixHex(accent, '#ffffff', 0.35),
        soft,
        mixHex(accent, '#ffffff', 0.45),
        mixHex(strong, '#0f172a', 0.12),
        mixHex(strong, '#ffffff', 0.18),
        mixHex(accent, '#0f172a', 0.18)
    ];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const hex of picks) {
        const norm = hex.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        out.push(norm);
    }

    while (out.length < INCOME_TREEMAP_PALETTE.length) {
        const i = out.length;
        const t = 0.08 + (i % 7) * 0.07;
        const next = mixHex(accent, '#0f172a', Math.min(0.58, t)).toLowerCase();
        if (!seen.has(next)) {
            seen.add(next);
            out.push(next);
        } else {
            break;
        }
    }

    return out.length ? out : [...INCOME_TREEMAP_PALETTE];
}

/** Re-lê a paleta quando o perfil ou o tema mudam (mesmo gatilho dos gráficos do painel). */
export function useGainsTreemapPalette(): string[] {
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const bump = () => setRevision((n) => n + 1);
        window.addEventListener(PROFILE_UPDATED_EVENT, bump);
        window.addEventListener('meumundo-themechange', bump);
        return () => {
            window.removeEventListener(PROFILE_UPDATED_EVENT, bump);
            window.removeEventListener('meumundo-themechange', bump);
        };
    }, []);

    return useMemo(() => buildGainsTreemapPalette(), [revision]);
}
import { greatCircleArc } from './great-circle.js';

/** Afastamento leve do arco para ida/volta não empilharem. */
export function offsetArcCoordinates(coords, offsetDeg) {
    if (!Array.isArray(coords) || coords.length < 3 || offsetDeg === 0) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    return coords.map((c, i) => {
        const t = i / (coords.length - 1);
        const bulge = Math.sin(Math.PI * t);
        return [c[0] + px * offsetDeg * bulge, c[1] + py * offsetDeg * bulge];
    });
}

/** Ondulação suave para trecho terrestre. */
export function undulatePathCoordinates(coords, ampDeg) {
    if (!Array.isArray(coords) || coords.length < 5 || ampDeg === 0) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    return coords.map((c, i) => {
        const t = i / (coords.length - 1);
        const wave = Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t);
        return [c[0] + px * ampDeg * wave, c[1] + py * ampDeg * wave];
    });
}

/**
 * Geometria terrestre/a pé no atlas (paridade visual com roteiros).
 * @param {{ lng: number, lat: number }} from
 * @param {{ lng: number, lat: number }} to
 * @param {'ground' | 'walk'} kind
 * @param {number} distKm
 */
export function groundPathCoordinates(from, to, kind, distKm) {
    const steps =
        kind === 'walk'
            ? Math.max(20, Math.min(40, Math.round(distKm * 2.2) + 16))
            : Math.max(28, Math.min(56, Math.round(distKm * 1.4) + 22));
    let coords = greatCircleArc(from, to, steps);
    const sign = Math.abs((from.lng * 12.3 + to.lat * 7.1 + from.lat * 3.7) * 100) % 2 >= 1 ? 1 : -1;
    const primary = Math.min(0.7, Math.max(0.1, distKm / 140)) * sign;
    coords = offsetArcCoordinates(coords, primary);
    if (kind === 'ground') {
        coords = undulatePathCoordinates(coords, primary * 0.28);
    } else {
        coords = undulatePathCoordinates(coords, primary * 0.14);
    }
    const start = [from.lng, from.lat];
    const end = [to.lng, to.lat];
    if (coords.length >= 2) {
        coords[0] = start;
        coords[coords.length - 1] = end;
    }
    return coords;
}
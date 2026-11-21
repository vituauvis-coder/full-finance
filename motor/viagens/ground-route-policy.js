/**
 * Política de trechos terrestres no mapa/roteiro.
 * Trem-bala e deslocamentos manuais no mesmo país não devem ser forçados a “voo”
 * só porque passam de ~280 km.
 */

export const AUTO_FLIGHT_KM = 280;
const WALK_KM = 12;

const TRAIN_KINDS = new Set(['train']);
const LONG_GROUND_KINDS = new Set(['train', 'bus']);

export function isRailGroundKind(kind) {
    return TRAIN_KINDS.has(String(kind ?? '').trim());
}

export function isLongGroundKind(kind) {
    return LONG_GROUND_KINDS.has(String(kind ?? '').trim());
}

/**
 * Velocidade média visual (km/h) por tipo de terrestre.
 * Trem longo ≈ HSR; trechos curtos de trem ≈ regional.
 */
export function groundSpeedKmh(km, groundKind = null) {
    if (isRailGroundKind(groundKind)) {
        if (km >= 200) return 250;
        if (km >= 80) return 160;
        return 90;
    }
    if (km <= 12) return 22;
    if (km <= 40) return 45;
    return 70;
}

export function estimateGroundDurationMin(km, groundKind = null) {
    if (!Number.isFinite(km) || km <= 0) return 1;
    const speed = groundSpeedKmh(km, groundKind);
    if (!Number.isFinite(speed) || speed <= 0) return 1;
    return Math.max(1, Math.round((km / speed) * 60));
}

/**
 * Desenhar linha pontilhada quando o usuário marcou terrestre manualmente.
 */
export function shouldDrawManualGroundLeg(
    distKm,
    { sameCountry = false, groundKind = null } = {}
) {
    if (!Number.isFinite(distKm) || distKm < 0.05) return false;
    if (isLongGroundKind(groundKind)) return true;
    if (sameCountry) return true;
    return distKm < AUTO_FLIGHT_KM;
}

/**
 * Respeita travelMode manual ground vs classificação automática “flight”.
 */
export function honorManualGroundMode(
    autoMode,
    manualMode,
    distKm,
    { sameCountry = false, groundKind = null } = {}
) {
    if (manualMode !== 'ground') return manualMode ?? autoMode;
    if (autoMode !== 'flight') return 'ground';
    if (shouldDrawManualGroundLeg(distKm, { sameCountry, groundKind })) return 'ground';
    if (distKm >= AUTO_FLIGHT_KM) return 'flight';
    return 'ground';
}

export function walkDistanceCapKm() {
    return WALK_KM;
}

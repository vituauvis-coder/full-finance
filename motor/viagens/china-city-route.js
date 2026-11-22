import { haversineKm } from './geo-distance.js';
import { estimateGroundDurationMin } from './ground-route-policy.js';

function foldKey(s) {
    return String(s ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

export function isChinaDestination(dest) {
    if (!dest || typeof dest !== 'object') return false;
    if (dest.kind === 'country') return false;
    const country = foldKey(dest.country ?? '');
    const name = foldKey(dest.name ?? '');
    const city = foldKey(dest.city ?? '');
    if (country.includes('china') || country === 'cn') return true;
    if (name.includes('china') && dest.kind === 'country') return false;
    if (/xangai|shanghai|pequim|beijing|furong|chongqing|shenzhen|guangzhou|chengdu/.test(name)) return true;
    if (/xangai|shanghai|pequim|beijing/.test(city)) return true;
    return false;
}

/** IDs de destinos com pin na China (mapa/planejamento). */
export function chinaRoutableCityIds(destinations = []) {
    return destinations
        .filter(
            (d) =>
                isChinaDestination(d) &&
                d.kind !== 'country' &&
                Number.isFinite(d.latitude) &&
                Number.isFinite(d.longitude)
        )
        .map((d) => d.id);
}

/**
 * #1 fixo: aeroporto/cidade da primeira chegada internacional na China (ex.: PEK).
 */
export function chinaArrivalAnchorId(destinations = [], payload = {}) {
    const byId = new Map(destinations.map((d) => [d.id, d]));
    const itinerary = payload.itinerary ?? [];
    for (const day of itinerary) {
        for (const item of day.items ?? []) {
            const id = String(item.id ?? '');
            if (!id.includes('chegada')) continue;
            const destId = item.destinationId ?? null;
            if (destId && byId.has(destId) && isChinaDestination(byId.get(destId))) {
                return destId;
            }
            const place = String(item.placeName ?? item.title ?? '');
            if (/pequim|beijing|pek|china/i.test(place)) {
                const pek =
                    destinations.find((d) => d.id === 'rote-aero-pek') ??
                    destinations.find(
                        (d) =>
                            isChinaDestination(d) &&
                            (d.kind === 'airport' || /pequim|beijing/i.test(String(d.name ?? '')))
                    );
                if (pek) return pek.id;
            }
        }
    }
    const pek =
        destinations.find((d) => d.id === 'rote-aero-pek') ??
        destinations.find(
            (d) => isChinaDestination(d) && d.kind === 'airport' && Number.isFinite(d.latitude)
        );
    return pek?.id ?? null;
}

export function readChinaRouteOrder(payload = {}) {
    const raw = payload.china_city_route_order ?? payload.chinaCityRouteOrder;
    return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

/** Ordem salva + cidades novas; âncora sempre na posição 1. */
export function resolveChinaRouteOrder(destinations = [], payload = {}) {
    const anchorId = chinaArrivalAnchorId(destinations, payload);
    const pool = new Set(chinaRoutableCityIds(destinations));
    let order = readChinaRouteOrder(payload).filter((id) => pool.has(id));
    for (const id of pool) {
        if (!order.includes(id)) order.push(id);
    }
    if (anchorId && pool.has(anchorId)) {
        order = [anchorId, ...order.filter((id) => id !== anchorId)];
    }
    return { order, anchorId, poolSize: pool.size };
}

export function reorderChinaRoute(order, fromIndex, toIndex, anchorId) {
    const list = [...order];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
        return list;
    }
    if (anchorId && (fromIndex === 0 || toIndex === 0)) return list;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    if (anchorId) {
        const idx = list.indexOf(anchorId);
        if (idx > 0) {
            list.splice(idx, 1);
            list.unshift(anchorId);
        }
    }
    return list;
}

function formatMinutesLabel(minutes) {
    const m = Math.max(1, Math.round(minutes));
    if (m < 60) return `~${m} min`;
    const h = m / 60;
    if (h < 10) {
        const rounded = Math.round(h * 2) / 2;
        const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
        return `~${text} h`;
    }
    return `~${Math.round(h)} h`;
}

function formatCnyRange(minCny, maxCny) {
    const lo = Math.round(minCny);
    const hi = Math.round(maxCny);
    if (lo === hi) return `¥${lo}`;
    return `¥${lo} – ¥${hi}`;
}

/** Estimativa trem-bala vs voo doméstico (faixas em CNY). */
export function compareChinaLeg(from, to) {
    const km = haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
    if (km == null || !Number.isFinite(km) || km < 0.05) return null;
    const trainMin = estimateGroundDurationMin(km, 'train');
    const flightMin = Math.max(50, Math.round((km / 720) * 60) + 100);
    const trainPriceMin = km * 0.42;
    const trainPriceMax = km * 0.78;
    const flightPriceMin = 320 + km * 0.55;
    const flightPriceMax = 780 + km * 1.05;
    return {
        km: Math.round(km),
        train: {
            durationMin: trainMin,
            durationLabel: formatMinutesLabel(trainMin),
            priceLabel: formatCnyRange(trainPriceMin, trainPriceMax)
        },
        flight: {
            durationMin: flightMin,
            durationLabel: formatMinutesLabel(flightMin),
            priceLabel: formatCnyRange(flightPriceMin, flightPriceMax)
        }
    };
}

export function buildChinaRouteLegs(order, destinations) {
    const byId = new Map(destinations.map((d) => [d.id, d]));
    const legs = [];
    for (let i = 0; i < order.length - 1; i++) {
        const from = byId.get(order[i]);
        const to = byId.get(order[i + 1]);
        if (!from || !to) continue;
        const compare = compareChinaLeg(from, to);
        if (!compare) continue;
        legs.push({
            id: `china-leg-${from.id}-${to.id}`,
            index: i + 1,
            fromId: from.id,
            toId: to.id,
            fromLabel: from.name,
            toLabel: to.name,
            compare
        });
    }
    return legs;
}
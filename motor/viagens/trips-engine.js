import {
    dayKey,
    parseDayKey,
    startOfDayInLifeOS,
    toApiDayKey,
    inclusiveDayCount as calInclusive
} from './calendar-format.js';
import { isHomeDestination } from './trip-places.js';
import { sumGroundTransportAmount } from './ground-transport.js';

export const TRIP_STATUSES = ['planejada', 'em_curso', 'realizada'];
export const EXPENSE_CATEGORIES = ['hospedagem', 'comida', 'transporte', 'passeios', 'extras'];
export const MAX_AUTO_ITINERARY_DAYS = 90;

const monthYearFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function normalizeStatus(raw) {
    const s = String(raw ?? '');
    if (s === 'em_curso' || s === 'emCurso') return 'em_curso';
    if (s === 'realizada' || s === 'Concluída') return 'realizada';
    return 'planejada';
}

function startOfDayKey(key) {
    return key ? startOfDayInLifeOS(parseDayKey(key)) : null;
}

export function effectiveStatus({ startsOn, endsOn, statusOverride, now = new Date() }) {
    if (statusOverride && TRIP_STATUSES.includes(statusOverride)) {
        return statusOverride;
    }
    const today = startOfDayInLifeOS(now);
    const start = startOfDayKey(startsOn);
    const end = startOfDayKey(endsOn);
    if (!start && !end) return 'planejada';
    if (start && !end) return today < start ? 'planejada' : 'em_curso';
    if (!start && end) return today < end ? 'planejada' : 'realizada';
    if (today < start) return 'planejada';
    if (today > end) return 'realizada';
    return 'em_curso';
}

export function spent(trip, { category = null, customCategoryId = null, destinationId = null } = {}) {
    const payload = trip.payload ?? {};
    let expenses = payload.expenses ?? [];
    if (category) {
        expenses = expenses.filter((e) => !e.customCategoryId && e.category === category);
    }
    if (customCategoryId) {
        expenses = expenses.filter((e) => e.customCategoryId === customCategoryId);
    }
    if (destinationId) {
        expenses = expenses.filter((e) => e.destinationId === destinationId);
    }
    let sum = expenses.reduce((p, e) => p + Number(e.amount ?? 0), 0);

    if (!category || category === 'hospedagem') {
        for (const stay of payload.stays ?? []) {
            if (destinationId && stay.destinationId !== destinationId) continue;
            sum += Number(stay.amount ?? 0);
        }
    }
    if (!category || category === 'transporte') {
        sum += sumGroundTransportAmount(payload, { destinationId });
    }
    return sum;
}

export function tripTotal(trip) {
    return spent(trip);
}

export function citySpent(trip, destinationId) {
    return spent(trip, { destinationId });
}

export function capFor(trip, category) {
    const caps = trip.budget_caps ?? trip.budgetCaps ?? {};
    return Number(caps[category] ?? 0);
}

export function budgets(trip) {
    return EXPENSE_CATEGORIES.map((category) => ({
        category,
        cap: capFor(trip, category),
        spent: spent(trip, { category })
    }));
}

export function capUsedFraction(trip) {
    const caps = trip.budget_caps ?? trip.budgetCaps ?? {};
    const custom = trip.payload?.budgetCustomCategories ?? trip.payload?.budget_custom_categories ?? [];
    const cappedBuiltins = EXPENSE_CATEGORIES.filter((c) => capFor(trip, c) > 0);
    const cappedCustom = custom.filter((c) => Number(caps[c.id] ?? 0) > 0);
    const totalCap =
        cappedBuiltins.reduce((p, c) => p + capFor(trip, c), 0) +
        cappedCustom.reduce((p, c) => p + Number(caps[c.id] ?? 0), 0);
    if (totalCap <= 0) return 0;
    const used =
        cappedBuiltins.reduce((p, c) => p + spent(trip, { category: c }), 0) +
        cappedCustom.reduce((p, c) => p + spent(trip, { customCategoryId: c.id }), 0);
    return used / totalCap;
}

export function hover(trip, destination) {
    const dayKeySrc = destination.arrivedOn ?? destination.arrived_on ?? trip.starts_on ?? trip.startsOn ?? trip.ends_on ?? trip.endsOn;
    let monthYear = '';
    if (dayKeySrc) {
        const d = parseDayKey(dayKeySrc);
        if (d) monthYear = monthYearFmt.format(d);
    }
    const destId = destination.id;
    return {
        placeName: destination.name,
        tripTitle: trip.title,
        monthYear,
        citySpent: citySpent(trip, destId),
        tripTotal: tripTotal(trip)
    };
}

export function visits(trips, now = new Date()) {
    const out = [];
    for (const trip of trips) {
        const status = effectiveStatus({
            startsOn: trip.starts_on ?? trip.startsOn,
            endsOn: trip.ends_on ?? trip.endsOn,
            statusOverride: trip.status_override ?? trip.statusOverride,
            now
        });
        for (const destination of trip.payload?.destinations ?? []) {
            if (isHomeDestination(destination)) continue;
            out.push({
                id: `${trip.id}-${destination.id}`,
                destination,
                tripId: trip.id,
                tripTitle: trip.title,
                status,
                hover: hover(trip, destination)
            });
        }
    }
    return out;
}

function roundedPoint(lat, lng) {
    return { lat: Math.round(lat * 10000), lng: Math.round(lng * 10000) };
}

export function displayCoordinate(visit, allVisits) {
    const key = roundedPoint(visit.destination.latitude, visit.destination.longitude);
    const same = allVisits.filter((v) => {
        const k = roundedPoint(v.destination.latitude, v.destination.longitude);
        return k.lat === key.lat && k.lng === key.lng;
    });
    const index = same.findIndex((v) => v.id === visit.id);
    return {
        lat: visit.destination.latitude,
        lng: visit.destination.longitude + 0.04 * index
    };
}

export function cluster(visits, spanLatitude = 1) {
    const threshold = Math.min(Math.max(spanLatitude * 0.04, 0.02), 0.4);
    const order = [];
    const groups = new Map();
    for (const visit of visits) {
        const coord = displayCoordinate(visit, visits);
        const cellKey = `${Math.round(coord.lat / threshold)}:${Math.round(coord.lng / threshold)}`;
        if (!groups.has(cellKey)) {
            order.push(cellKey);
            groups.set(cellKey, []);
        }
        groups.get(cellKey).push({ visit, ...coord });
    }
    return order.map((cellKey) => {
        const members = groups.get(cellKey);
        if (!members?.length) return null;
        const latitude = members.reduce((p, m) => p + m.lat, 0) / members.length;
        const longitude = members.reduce((p, m) => p + m.lng, 0) / members.length;
        return { visits: members.map((m) => m.visit), latitude, longitude };
    }).filter(Boolean);
}

function orderingRank(trip, now) {
    const status = effectiveStatus({
        startsOn: trip.starts_on ?? trip.startsOn,
        endsOn: trip.ends_on ?? trip.endsOn,
        statusOverride: trip.status_override ?? trip.statusOverride,
        now
    });
    const today = startOfDayInLifeOS(now).getTime();
    if (status === 'em_curso') return { group: 0, rank: 0 };
    if (status === 'planejada') {
        const start = startOfDayKey(trip.starts_on ?? trip.startsOn);
        if (!start) return { group: 1, rank: Number.MAX_SAFE_INTEGER };
        return { group: 1, rank: Math.abs(start.getTime() - today) };
    }
    const end = startOfDayKey(trip.ends_on ?? trip.endsOn);
    if (!end) return { group: 2, rank: Number.MAX_SAFE_INTEGER };
    return { group: 2, rank: -end.getTime() };
}

export function sortedTrips(trips, now = new Date()) {
    return trips
        .map((trip, index) => ({ trip, index, ord: orderingRank(trip, now) }))
        .sort((a, b) => {
            if (a.ord.group !== b.ord.group) return a.ord.group - b.ord.group;
            if (a.ord.rank !== b.ord.rank) return a.ord.rank - b.ord.rank;
            return a.index - b.index;
        })
        .map((x) => x.trip);
}

export function itineraryExceedsAutoCap(startsOn, endsOn) {
    const start = startOfDayKey(startsOn);
    const end = startOfDayKey(endsOn);
    if (!start || !end || start > end) return false;
    return calInclusive(start, end) > MAX_AUTO_ITINERARY_DAYS;
}

export function itineraryDays(startsOn, endsOn, existing = []) {
    const start = startOfDayKey(startsOn);
    const end = startOfDayKey(endsOn);
    if (!start || !end || start > end) return existing;
    if (calInclusive(start, end) > MAX_AUTO_ITINERARY_DAYS) return existing;
    const days = [];
    const usedKeys = new Set();
    let cursor = start;
    while (cursor <= end) {
        const key = dayKey(cursor);
        usedKeys.add(key);
        const match = existing.find((d) => d.dayKey === key || d.day_key === key);
        days.push(match ?? { id: crypto.randomUUID(), dayKey: key, day_key: key, items: [] });
        cursor = new Date(cursor.getTime() + 86400000);
        cursor = startOfDayInLifeOS(cursor);
    }
    // Não apagar atividades só porque a janela starts/ends mudou (ex.: datas desalinhadas do cenário).
    for (const day of existing) {
        const key = day.dayKey ?? day.day_key;
        if (!key || usedKeys.has(key)) continue;
        const items = day.items ?? [];
        if (!Array.isArray(items) || items.length === 0) continue;
        usedKeys.add(key);
        days.push(day);
    }
    days.sort((a, b) =>
        String(a.dayKey ?? a.day_key ?? '').localeCompare(String(b.dayKey ?? b.day_key ?? ''))
    );
    return days;
}

export function formatBRL(value) {
    return brlFmt.format(value);
}

export function flightCompare(simulations = []) {
    const mapped = simulations.filter((s) => s.status !== 'descartada' && Number(s.finalCost ?? s.amount + (s.extrasAmount ?? 0)) > 0);
    const finalCost = (s) => Number(s.finalCost ?? Number(s.amount ?? 0) + Number(s.extrasAmount ?? 0));
    const cheapest = mapped.reduce(
        (best, s) => (!best || finalCost(s) < finalCost(best) ? s : best),
        null
    );
    const average = mapped.length ? mapped.reduce((p, s) => p + finalCost(s), 0) / mapped.length : null;
    const hub = (s) => {
        const conn = s.connections?.[0]?.place ?? '';
        const dest = s.destination ?? '';
        const pick = (conn || dest).trim();
        if (!pick) return 'Direto';
        const idx = pick.indexOf(',');
        return idx >= 0 ? pick.slice(0, idx) : pick;
    };
    return {
        cheapestFinal: cheapest ? finalCost(cheapest) : null,
        averageFinal: average,
        cheapestHub: cheapest ? hub(cheapest) : null,
        mappedCount: mapped.length,
        cheapestId: cheapest?.id ?? null
    };
}

function tripCreator(row) {
    const id = row.user_id ?? row.userId;
    if (!id) return null;
    const name = row.creator_name ?? row.creatorName ?? null;
    const email = row.creator_email ?? row.creatorEmail ?? null;
    if (!name && !email) return { id, name: null, email: null };
    return { id, name, email };
}

/** Normaliza row do Postgres para objeto de domínio. */
export function normalizeTrip(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        creator: tripCreator(row),
        title: row.title ?? 'Nova viagem',
        startsOn: toApiDayKey(row.starts_on ?? row.startsOn),
        endsOn: toApiDayKey(row.ends_on ?? row.endsOn),
        statusOverride: row.status_override ?? null,
        budgetCaps: typeof row.budget_caps === 'object' ? row.budget_caps : {},
        payload: typeof row.payload === 'object' ? row.payload : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function enrichTripSummary(trip, now = new Date()) {
    const t = normalizeTrip(trip);
    const status = effectiveStatus({
        startsOn: t.startsOn,
        endsOn: t.endsOn,
        statusOverride: t.statusOverride,
        now
    });
    return {
        ...t,
        effectiveStatus: status,
        tripTotal: tripTotal(t),
        capUsedFraction: capUsedFraction(t),
        cityCount: (t.payload?.destinations ?? []).filter((d) => !isHomeDestination(d)).length
    };
}
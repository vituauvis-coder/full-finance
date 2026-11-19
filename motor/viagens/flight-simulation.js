/** Normaliza simulações de voo (payload web + JSON do Mac). */

export const FLIGHT_STATUSES = ['candidata', 'escolhida', 'descartada'];
export const FLIGHT_INSIGHTS = ['recomendado', 'melhor_rota', 'escala_longa', 'visto_transito', 'custo_elevado'];

const STATUS_LABEL = {
    candidata: 'Opção',
    escolhida: 'Escolhido',
    descartada: 'Descartada'
};

const INSIGHT_LABEL = {
    recomendado: 'Recomendado',
    melhor_rota: 'Melhor rota',
    escala_longa: 'Escala longa',
    visto_transito: 'Exige visto trânsito',
    custo_elevado: 'Custo elevado'
};

export function flightStatusLabel(status) {
    return STATUS_LABEL[status] ?? STATUS_LABEL.candidata;
}

export function flightInsightLabel(insight) {
    return INSIGHT_LABEL[insight] ?? INSIGHT_LABEL.recomendado;
}

export function nextFlightStatus(status) {
    if (status === 'candidata') return 'escolhida';
    if (status === 'escolhida') return 'descartada';
    return 'candidata';
}

export function nextFlightInsight(insight) {
    const i = FLIGHT_INSIGHTS.indexOf(insight);
    return FLIGHT_INSIGHTS[(i + 1) % FLIGHT_INSIGHTS.length];
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function simulationTicketCost(sim) {
    return Math.max(num(sim?.amount), 0);
}

export function simulationExtrasCost(sim) {
    return Math.max(num(sim?.extrasAmount ?? sim?.extras_amount), 0);
}

export function simulationFinalCost(sim) {
    return simulationTicketCost(sim) + simulationExtrasCost(sim);
}

export function flightTravelers(sim) {
    const n = Math.trunc(Number(sim?.travelers ?? sim?.passengers) || 1);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(9, n);
}

function str(value) {
    return value == null ? '' : String(value);
}

function destinationPointsOf(src) {
    if (src.destinationPoints == null || src.destinationPoints === '') {
        if (src.destination_points == null || src.destination_points === '') return null;
        return num(src.destination_points);
    }
    return num(src.destinationPoints);
}

/** Um voo é milhas ou dinheiro — nunca os dois caminhos ao mesmo tempo. */
export function flightPayWith(sim) {
    const miles = sim?.miles && typeof sim.miles === 'object' ? sim.miles : sim;
    if (!miles || typeof miles !== 'object') return 'cash';
    if (miles.payWith === 'points') return 'points';
    if (miles.payWith === 'cash') return 'cash';
    const dest = destinationPointsOf(miles);
    return dest != null && dest > 0 ? 'points' : 'cash';
}

function normalizeMiles(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const destinationPoints = destinationPointsOf(src);
    const payWith = flightPayWith({ ...src, destinationPoints });
    return {
        payWith,
        originProgramId: src.originProgramId ?? src.origin_program_id ?? null,
        destinationProgramId: src.destinationProgramId ?? src.destination_program_id ?? null,
        destinationPoints,
        taxesAmount:
            src.taxesAmount == null || src.taxesAmount === ''
                ? src.taxes_amount == null || src.taxes_amount === ''
                    ? null
                    : num(src.taxes_amount)
                : num(src.taxesAmount),
        taxesCurrency: str(src.taxesCurrency ?? src.taxes_currency) || 'EUR',
        taxFxRate:
            src.taxFxRate == null || src.taxFxRate === ''
                ? src.tax_fx_rate == null || src.tax_fx_rate === ''
                    ? null
                    : num(src.tax_fx_rate)
                : num(src.taxFxRate),
        taxIofPercent: Number(src.taxIofPercent ?? src.tax_iof_percent) || 0,
        taxSpreadPercent: Number(src.taxSpreadPercent ?? src.tax_spread_percent) || 0,
        conversionFrom: Math.max(1, Math.trunc(Number(src.conversionFrom ?? src.conversion_from) || 2)),
        conversionTo: Math.max(1, Math.trunc(Number(src.conversionTo ?? src.conversion_to) || 1)),
        bonusPercent: Number(src.bonusPercent ?? src.bonus_percent) || 0,
        bonusActive: src.bonusActive === false || src.bonus_active === false ? false : true,
        emissionId: src.emissionId ?? src.emission_id ?? null
    };
}

function connectionsOf(raw, key, snake) {
    const list = raw?.[key] ?? raw?.[snake] ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((c) => ({
        id: c.id ?? crypto.randomUUID(),
        place: str(c.place),
        layoverMinutes: c.layoverMinutes ?? c.layover_minutes ?? null
    }));
}

export const BAGGAGE_OPTIONS = [
    { key: 'kg10', kg: 10, label: 'Cabine' },
    { key: 'kg23', kg: 23, label: 'Despacho' },
    { key: 'kg32', kg: 32, label: 'Extra' }
];

export function emptyBaggage() {
    return { kg10: 0, kg23: 0, kg32: 0 };
}

function qty(value) {
    const n = Math.trunc(Number(value) || 0);
    return Number.isFinite(n) ? Math.max(0, Math.min(9, n)) : 0;
}

export function normalizeBaggage(raw, included = false) {
    if (raw && typeof raw === 'object') {
        return {
            kg10: qty(raw.kg10 ?? raw.cabin10),
            kg23: qty(raw.kg23 ?? raw.hold23),
            kg32: qty(raw.kg32 ?? raw.hold32)
        };
    }
    return included ? { kg10: 0, kg23: 1, kg32: 0 } : emptyBaggage();
}

export function baggageHasPieces(b) {
    const bag = b ?? emptyBaggage();
    return qty(bag.kg10) + qty(bag.kg23) + qty(bag.kg32) > 0;
}

export function baggageLabel(b) {
    const bag = b ?? emptyBaggage();
    const bits = BAGGAGE_OPTIONS.filter((o) => qty(bag[o.key]) > 0).map((o) =>
        qty(bag[o.key]) > 1 ? `${qty(bag[o.key])}×${o.kg} kg` : `${o.kg} kg`
    );
    return bits.length ? bits.join(' · ') : null;
}

export function emptyFlightSimulation() {
    return {
        id: crypto.randomUUID(),
        label: '',
        origin: '',
        destination: '',
        departsAt: null,
        arrivesAt: null,
        connections: [],
        isRoundTrip: false,
        returnDepartsAt: null,
        returnArrivesAt: null,
        returnConnections: [],
        amount: null,
        extrasAmount: null,
        baggage: emptyBaggage(),
        baggageIncluded: false,
        insight: 'recomendado',
        notes: '',
        status: 'candidata',
        tripDestinationId: null,
        bookingURL: null,
        travelers: 1,
        miles: normalizeMiles(null)
    };
}

export function normalizeFlightSimulation(raw = {}) {
    const base = emptyFlightSimulation();
    const baggage = normalizeBaggage(raw.baggage, !!(raw.baggageIncluded ?? raw.baggage_included));
    return {
        ...base,
        id: raw.id ?? base.id,
        label: str(raw.label),
        origin: str(raw.origin),
        destination: str(raw.destination),
        departsAt: raw.departsAt ?? raw.departs_at ?? null,
        arrivesAt: raw.arrivesAt ?? raw.arrives_at ?? null,
        connections: connectionsOf(raw, 'connections', 'connections'),
        isRoundTrip: !!(raw.isRoundTrip ?? raw.is_round_trip),
        returnDepartsAt: raw.returnDepartsAt ?? raw.return_departs_at ?? null,
        returnArrivesAt: raw.returnArrivesAt ?? raw.return_arrives_at ?? null,
        returnConnections: connectionsOf(raw, 'returnConnections', 'return_connections'),
        amount: raw.amount == null || raw.amount === '' ? null : num(raw.amount),
        extrasAmount: (() => {
            const extras = raw.extrasAmount ?? raw.extras_amount;
            return extras == null || extras === '' ? null : num(extras);
        })(),
        baggage,
        baggageIncluded: baggageHasPieces(baggage),
        insight: FLIGHT_INSIGHTS.includes(raw.insight) ? raw.insight : 'recomendado',
        notes: str(raw.notes),
        status: FLIGHT_STATUSES.includes(raw.status) ? raw.status : 'candidata',
        tripDestinationId: raw.tripDestinationId ?? raw.trip_destination_id ?? null,
        bookingURL: raw.bookingURL ?? raw.booking_url ?? null,
        travelers: flightTravelers(raw),
        miles: normalizeMiles(raw.miles)
    };
}

export function normalizeFlightSegment(raw = {}) {
    const sims = Array.isArray(raw.simulations) ? raw.simulations : [];
    return {
        id: raw.id ?? crypto.randomUUID(),
        title: str(raw.title) || 'Trecho',
        simulations: sims.map(normalizeFlightSimulation)
    };
}

export function tripFlightSegments(payload = {}) {
    const list = payload.flight_segments ?? payload.flightSegments ?? [];
    return Array.isArray(list) ? list.map(normalizeFlightSegment) : [];
}

function shortPlace(value) {
    const t = str(value).trim();
    if (!t) return '—';
    const cut = t.split(',')[0].trim();
    return cut.length > 22 ? `${cut.slice(0, 20)}…` : cut;
}

export function simulationRouteSummary(sim) {
    const origin = shortPlace(sim.origin);
    const destination = shortPlace(sim.destination);
    const hubs = (sim.connections ?? []).map((c) => shortPlace(c.place)).filter((p) => p !== '—');
    if (!hubs.length) return `${origin} → ${destination}`;
    return [origin, ...hubs, destination].join(' → ');
}

export function simulationLabelLine(sim) {
    const label = str(sim.label).trim();
    return label || simulationRouteSummary(sim);
}

function filledConnections(list) {
    return (list ?? []).filter((c) => str(c.place).trim());
}

export function connectionsCount(sim) {
    const outbound = filledConnections(sim.connections).length;
    const inbound = sim?.isRoundTrip ? filledConnections(sim.returnConnections).length : 0;
    return outbound + inbound;
}

export function connectionsCountLabel(sim) {
    const outbound = filledConnections(sim.connections).length;
    if (!sim.isRoundTrip) {
        if (outbound === 0) return 'Direto';
        return outbound === 1 ? '1 conexão' : `${outbound} conexões`;
    }
    const inbound = filledConnections(sim.returnConnections).length;
    if (outbound === 0 && inbound === 0) return 'Direto · ida e volta';
    const ida = outbound === 0 ? 'Ida direta' : outbound === 1 ? '1 conexão ida' : `${outbound} conexões ida`;
    const volta = inbound === 0 ? 'volta direta' : inbound === 1 ? '1 conexão volta' : `${inbound} conexões volta`;
    return `${ida} · ${volta}`;
}

export function duplicateFlightSimulation(sim) {
    const copy = normalizeFlightSimulation(sim);
    copy.id = crypto.randomUUID();
    if (copy.status === 'escolhida') copy.status = 'candidata';
    copy.connections = copy.connections.map((c) => ({ ...c, id: crypto.randomUUID() }));
    copy.returnConnections = copy.returnConnections.map((c) => ({ ...c, id: crypto.randomUUID() }));
    if (copy.miles) copy.miles = { ...copy.miles, emissionId: null };
    const trimmed = copy.label.trim();
    if (trimmed && !trimmed.endsWith('(cópia)')) copy.label = `${trimmed} (cópia)`;
    return copy;
}

export function sortFlightSimulations(list = []) {
    const rank = { escolhida: 0, candidata: 1, descartada: 2 };
    return [...list].sort((a, b) => {
        const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (r) return r;
        const left = simulationFinalCost(a) || Number.POSITIVE_INFINITY;
        const right = simulationFinalCost(b) || Number.POSITIVE_INFINITY;
        return left - right;
    });
}

export function connectionLegRows(sim) {
    const rows = [];
    const outbound = filledConnections(sim?.connections).map((c) => shortPlace(c.place));
    if (outbound.length) {
        rows.push({ id: 'outbound', leg: 'outbound', label: outbound.join(' → ') });
    }
    if (sim?.isRoundTrip) {
        const inbound = filledConnections(sim.returnConnections).map((c) => shortPlace(c.place));
        if (inbound.length) {
            rows.push({ id: 'inbound', leg: 'inbound', label: inbound.join(' → ') });
        }
    }
    return rows;
}

export function googleFlightsSearchURL({ origin, destination, departsOn, returnOn }) {
    const from = str(origin).trim();
    const to = str(destination).trim();
    if (!from || !to) return null;
    const parts = [`Flights from ${from} to ${to}`];
    const out = str(departsOn).slice(0, 10);
    const back = str(returnOn).slice(0, 10);
    if (out) parts.push(`on ${out}`);
    if (back) parts.push(`returning ${back}`);
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`;
}

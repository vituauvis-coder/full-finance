/** Registros de transporte não aéreo (carro, trem, ônibus, etc.) no payload da viagem. */

export const GROUND_TRANSPORT_KINDS = [
    { id: 'car_rental', label: 'Carro alugado', icon: 'directions_car' },
    { id: 'train', label: 'Trem / bala', icon: 'train' },
    { id: 'bus', label: 'Ônibus', icon: 'directions_bus' },
    { id: 'taxi', label: 'Táxi', icon: 'local_taxi' },
    { id: 'rideshare', label: 'App (Uber, etc.)', icon: 'smartphone' },
    { id: 'ferry', label: 'Balsa / ferry', icon: 'directions_boat' },
    { id: 'metro', label: 'Metrô / transporte local', icon: 'subway' },
    { id: 'other', label: 'Outro', icon: 'more_horiz' }
];

const KIND_LABEL = Object.fromEntries(GROUND_TRANSPORT_KINDS.map((k) => [k.id, k.label]));

export function groundTransportKindLabel(kind) {
    const id = String(kind ?? 'other');
    return KIND_LABEL[id] ?? KIND_LABEL.other;
}

export function groundTransportsFromPayload(payload = {}) {
    const list = payload.ground_transports ?? payload.groundTransports;
    if (Array.isArray(list)) return list;
    return (payload.legs ?? []).map((leg) => ({
        ...leg,
        kind: leg.kind && leg.kind !== 'voo' ? leg.kind : 'other'
    }));
}

export function groundTransportTitle(item) {
    const custom = String(item?.title ?? '').trim();
    if (custom) return custom;
    const from = String(item?.fromName ?? item?.from_name ?? '').trim();
    const to = String(item?.toName ?? item?.to_name ?? '').trim();
    if (from && to) return `${from} → ${to}`;
    if (from || to) return from || to;
    return groundTransportKindLabel(item?.kind);
}

export function groundTransportAmount(item) {
    return Math.max(0, Number(item?.amount ?? 0) || 0);
}

export function groundTransportDestinationId(item) {
    return item?.tripDestinationId ?? item?.trip_destination_id ?? null;
}

/** Usos no roteiro vinculados a um bilhete terrestre. */
export function itineraryGroundTransportUses(itinerary, ticketId) {
    const id = String(ticketId ?? '').trim();
    if (!id) return 0;
    let uses = 0;
    for (const day of itinerary ?? []) {
        for (const item of day.items ?? []) {
            const itemId = String(item?.id ?? '');
            if (itemId.startsWith('rote-flight-')) continue;
            const linked = item?.groundTransportId ?? item?.ground_transport_id ?? null;
            if (linked === id) uses += 1;
        }
    }
    return uses;
}

/** Vezes usado no roteiro × valor unitário do bilhete. */
export function groundTransportRoteiroStats(payload = {}, ticketId) {
    const list = groundTransportsFromPayload(payload);
    const ticket = list.find((t) => t.id === ticketId);
    const uses = itineraryGroundTransportUses(payload?.itinerary ?? [], ticketId);
    const unitAmount = ticket ? groundTransportAmount(ticket) : 0;
    return { uses, unitAmount, totalAmount: uses * unitAmount };
}

export function sumGroundTransportAmount(payload = {}, { destinationId = null } = {}) {
    let sum = 0;
    for (const item of groundTransportsFromPayload(payload)) {
        const dest = groundTransportDestinationId(item);
        if (destinationId != null && dest !== destinationId) continue;
        sum += groundTransportAmount(item);
    }
    return sum;
}
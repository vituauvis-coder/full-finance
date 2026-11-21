import {
    GROUND_TRANSPORT_KINDS,
    groundTransportKindIcon,
    groundTransportRoteiroStats,
    itineraryGroundTransportUses
} from '@motor/viagens/ground-transport.js';
import type { TripGroundTransport, TripGroundTransportKind } from '../types';

export {
    GROUND_TRANSPORT_KINDS,
    groundTransportKindIcon,
    groundTransportRoteiroStats,
    itineraryGroundTransportUses
};

export function normalizeGroundTransports(
    payload: { ground_transports?: TripGroundTransport[]; groundTransports?: TripGroundTransport[]; legs?: TripGroundTransport[] }
): TripGroundTransport[] {
    const direct = payload.ground_transports ?? payload.groundTransports;
    if (Array.isArray(direct)) return direct;
    return (payload.legs ?? []).map((leg) => ({
        ...leg,
        kind: (leg.kind === 'voo' ? 'other' : leg.kind) as TripGroundTransportKind | undefined
    }));
}

export function groundTransportLabel(item: TripGroundTransport): string {
    const custom = (item.title ?? '').trim();
    if (custom) return custom;
    const from = (item.fromName ?? item.from_name ?? '').trim();
    const to = (item.toName ?? item.to_name ?? '').trim();
    if (from && to) return `${from} → ${to}`;
    if (from || to) return from || to;
    const kind = GROUND_TRANSPORT_KINDS.find((k) => k.id === item.kind);
    return kind?.label ?? 'Transporte';
}

export function newGroundTransport(partial: Partial<TripGroundTransport> = {}): TripGroundTransport {
    return {
        id: crypto.randomUUID(),
        kind: 'other',
        amount: 0,
        ...partial
    };
}
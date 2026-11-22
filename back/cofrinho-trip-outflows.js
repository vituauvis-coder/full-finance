import { collectTripPayloadCofrinhoOutflows } from '../motor/dinheiro/cofrinho-trip-payload-outflows.js';
import { listTripsForUser } from './trips-repository.js';

/** Gastos do cofrinho ainda só no payload das viagens (ou espelho desatualizado). */
export async function fetchCofrinhoTripPayloadOutflows(userId) {
    const trips = await listTripsForUser(userId);
    return collectTripPayloadCofrinhoOutflows(
        trips.map((t) => ({
            id: t.id,
            title: t.title,
            payload: typeof t.payload === 'object' && t.payload != null ? t.payload : {}
        }))
    );
}
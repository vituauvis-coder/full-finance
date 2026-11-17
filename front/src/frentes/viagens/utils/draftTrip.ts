import type { Trip } from '../types';
import type { TripDraft } from '../components/ViagemFicha';

export function emptyTripDraft(): TripDraft {
    return {
        title: '',
        startsOn: '',
        endsOn: '',
        statusOverride: '',
        budgetCaps: {},
        payload: {
            destinations: [],
            expenses: [],
            stays: [],
            itinerary: [],
            legs: [],
            documents: [],
            checks: [],
            flight_segments: [],
            time_scenarios: [],
            budget_custom_categories: []
        }
    };
}

/** Rascunho local na rota /viagens/nova (ainda sem id no servidor). */
export function draftAsLocalTrip(draft: TripDraft): Trip {
    return {
        id: 'local-draft',
        title: draft.title.trim() || 'Nova viagem',
        startsOn: draft.startsOn || null,
        endsOn: draft.endsOn || null,
        statusOverride: draft.statusOverride || null,
        budgetCaps: { ...draft.budgetCaps },
        payload: { ...draft.payload },
        effectiveStatus: 'planejada',
        tripTotal: 0,
        cityCount: (draft.payload.destinations ?? []).filter((d) => d.name && !/recife/i.test(d.name)).length
    };
}
import { saveTrip } from './viagens-api.js';

export function createTripPersistor({ tripId, getDraft, onSaved, onError, onSaving }) {
    let timer = null;
    let saving = false;

    function mergePayload(server, client) {
        return { ...(server || {}), ...(client || {}) };
    }

    async function persist(draft, serverPayload) {
        if (!tripId || !draft) return;
        saving = true;
        onSaving?.(true);
        try {
            const payload = mergePayload(serverPayload, draft.payload);
            const { trip } = await saveTrip(tripId, {
                title: draft.title,
                startsOn: draft.startsOn || null,
                endsOn: draft.endsOn || null,
                statusOverride: draft.statusOverride || null,
                budgetCaps: draft.budgetCaps,
                payload
            });
            onSaved?.(trip, trip.payload ?? payload);
        } catch (e) {
            onError?.(e);
        } finally {
            saving = false;
            onSaving?.(false);
        }
    }

    function schedule(serverPayload) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            persist(getDraft(), serverPayload);
        }, 1200);
    }

    function flush(serverPayload) {
        clearTimeout(timer);
        return persist(getDraft(), serverPayload);
    }

    function dispose() {
        clearTimeout(timer);
    }

    return { schedule, flush, dispose, get saving() {
        return saving;
    } };
}
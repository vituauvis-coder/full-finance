import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTrip, saveTrip } from '../api/trips';
import type { Trip } from '../types';
import type { TripDraft } from '../components/ViagemFicha';

function mergePayload(server: Trip['payload'], draft: Trip['payload']): Trip['payload'] {
    return { ...server, ...draft };
}

export function useTripAutosave(tripId: string | undefined) {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [scenarioWinnerId, setScenarioWinnerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const latestDraft = useRef<TripDraft | null>(null);
    const serverPayload = useRef<Trip['payload']>({});
    const [dirty, setDirty] = useState(false);
    const [saveTick, setSaveTick] = useState(0);

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            setError(null);
            const data = await fetchTrip(tripId);
            setTrip(data.trip);
            serverPayload.current = data.trip.payload ?? {};
            setScenarioWinnerId(data.scenarioWinnerId ?? null);
            setDirty(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Viagem não encontrada');
        }
    }, [tripId]);

    useEffect(() => {
        void load();
    }, [load]);

    const persist = useCallback(
        async (draft: TripDraft) => {
            if (!tripId || !trip) return;
            setSaving(true);
            setSaveError(null);
            try {
                const payload = mergePayload(serverPayload.current, draft.payload);
                const { trip: saved } = await saveTrip(tripId, {
                    title: draft.title,
                    startsOn: draft.startsOn || null,
                    endsOn: draft.endsOn || null,
                    statusOverride: draft.statusOverride || null,
                    budgetCaps: draft.budgetCaps,
                    payload
                });
                serverPayload.current = saved.payload ?? payload;
                setTrip(saved);
                setDirty(false);
            } catch (e) {
                setSaveError(e instanceof Error ? e.message : 'Falha ao salvar');
            } finally {
                setSaving(false);
            }
        },
        [trip, tripId]
    );

    useEffect(() => {
        if (!dirty) return;
        const t = setTimeout(() => {
            if (latestDraft.current) void persist(latestDraft.current);
        }, 1200);
        return () => clearTimeout(t);
    }, [dirty, saveTick, persist]);

    const onDraftChange = useCallback((draft: TripDraft) => {
        latestDraft.current = draft;
        setTrip((t) =>
            t
                ? {
                      ...t,
                      title: draft.title,
                      startsOn: draft.startsOn || null,
                      endsOn: draft.endsOn || null,
                      statusOverride: draft.statusOverride || null,
                      budgetCaps: draft.budgetCaps,
                      payload: draft.payload
                  }
                : t
        );
        setDirty(true);
        setSaveTick((n) => n + 1);
    }, []);

    const saveNow = useCallback(
        async (draft: TripDraft) => {
            latestDraft.current = draft;
            await persist(draft);
        },
        [persist]
    );

    const flushSave = useCallback(async () => {
        if (!latestDraft.current) return;
        await persist(latestDraft.current);
    }, [persist]);

    return {
        trip,
        scenarioWinnerId,
        error,
        saveError,
        saving,
        onDraftChange,
        saveNow,
        flushSave,
        reload: load
    };
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTrip, saveTrip } from '../api/trips';
import type { Trip, TripExpense } from '../types';
import { tripToDraft, type TripDraft } from '../components/ViagemFicha';
import { alignDraftDatesToChosenScenario } from '../domain/tripResumoStats';

const FINANCE_REFRESH_EVENT = 'finance:data-changed';

function mergePayload(server: Trip['payload'], draft: Trip['payload']): Trip['payload'] {
    return { ...server, ...draft };
}

/** Após sync no servidor, preserva campos locais mas traz financeExpenseId da resposta. */
function mergeTripExpensesAfterSave(serverList: TripExpense[] | undefined, localList: TripExpense[] | undefined) {
    const saved = serverList ?? [];
    const local = localList ?? [];
    const localById = new Map(local.map((e) => [e.id, e]));
    if (saved.length === 0) return local;
    return saved.map((se) => {
        const lo = localById.get(se.id);
        if (!lo) return se;
        return {
            ...lo,
            financeExpenseId: se.financeExpenseId ?? se.finance_expense_id ?? lo.financeExpenseId,
            finance_expense_id: se.finance_expense_id ?? se.financeExpenseId ?? lo.finance_expense_id,
            accountId: se.accountId ?? se.account_id ?? lo.accountId,
            account_id: se.account_id ?? se.accountId ?? lo.account_id
        };
    });
}

export function useTripAutosave(tripId: string | undefined) {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [draft, setDraft] = useState<TripDraft | null>(null);
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
            let loaded = tripToDraft(data.trip);
            const aligned = alignDraftDatesToChosenScenario(loaded);
            if (aligned) loaded = aligned;
            const tripRow = aligned
                ? {
                      ...data.trip,
                      startsOn: loaded.startsOn || null,
                      endsOn: loaded.endsOn || null
                  }
                : data.trip;
            setTrip(tripRow);
            setDraft(loaded);
            latestDraft.current = loaded;
            serverPayload.current = data.trip.payload ?? {};
            setScenarioWinnerId(data.scenarioWinnerId ?? null);
            if (aligned) {
                setDirty(true);
                setSaveTick((n) => n + 1);
            } else {
                setDirty(false);
            }
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
                const savedResponse = await saveTrip(tripId, {
                    title: draft.title,
                    startsOn: draft.startsOn || null,
                    endsOn: draft.endsOn || null,
                    statusOverride: draft.statusOverride || null,
                    budgetCaps: draft.budgetCaps,
                    payload
                });
                const saved = savedResponse.trip;
                const syncWarnings = savedResponse.financeSyncWarnings ?? [];
                serverPayload.current = saved.payload ?? payload;
                const savedDraft = tripToDraft(saved);
                if (syncWarnings.length > 0) {
                    setSaveError(
                        syncWarnings.map((w) => w.message).filter(Boolean).join(' · ') ||
                            'Alguns gastos não foram espelhados no Dinheiro'
                    );
                }
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent(FINANCE_REFRESH_EVENT));
                }
                setDraft((prev) => {
                    const base = prev ?? savedDraft;
                    const mergedExpenses = mergeTripExpensesAfterSave(
                        savedDraft.payload.expenses,
                        base.payload.expenses
                    );
                    const next: TripDraft = {
                        ...base,
                        title: saved.title ?? base.title,
                        startsOn: saved.startsOn ?? base.startsOn ?? '',
                        endsOn: saved.endsOn ?? base.endsOn ?? '',
                        statusOverride: saved.statusOverride ?? base.statusOverride ?? '',
                        budgetCaps: { ...(saved.budgetCaps ?? {}), ...(base.budgetCaps ?? {}) },
                        payload: {
                            ...savedDraft.payload,
                            ...base.payload,
                            expenses: mergedExpenses
                        }
                    };
                    latestDraft.current = next;
                    return next;
                });
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

    const onDraftChange = useCallback((next: TripDraft) => {
        latestDraft.current = next;
        setDraft(next);
        setTrip((t) =>
            t
                ? {
                      ...t,
                      title: next.title,
                      startsOn: next.startsOn || null,
                      endsOn: next.endsOn || null,
                      statusOverride: next.statusOverride || null,
                      budgetCaps: { ...next.budgetCaps },
                      payload: next.payload
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
        draft,
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
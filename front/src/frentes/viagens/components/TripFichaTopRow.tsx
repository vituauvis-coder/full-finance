import { useMemo } from 'react';
import type { Trip, TripCofrinhoMeta, TripFinanceMovementLine } from '../types';
import type { TripDraft } from './ViagemFicha';
import { TripCalendarCard } from './TripCalendarCard';
import { TripChecklistPanel } from './TripChecklistPanel';
import { TripResumoPanel } from './TripResumoPanel';
import '../styles/trip-ficha-top.css';
import '../styles/viagens-ficha-panels.css';

type Props = {
    trip: Trip;
    draft: TripDraft;
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
    scenarioCount?: number;
    onOpenSimulador?: () => void;
    financeMovements?: TripFinanceMovementLine[];
    tripCofrinhoMeta?: TripCofrinhoMeta | null;
};

export function TripFichaTopRow({
    trip,
    draft,
    onPatch,
    scenarioCount = 0,
    onOpenSimulador,
    financeMovements = [],
    tripCofrinhoMeta = null
}: Props) {
    const checks = draft.payload.checks ?? [];
    const documents = draft.payload.documents ?? [];
    const destinations = draft.payload.destinations ?? [];

    const nextTaskDayKey = useMemo(() => {
        for (const c of checks) {
            if (c.done) continue;
            const raw = c.dueOn ?? c.due_on;
            const key = raw?.trim().slice(0, 10);
            if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
        }
        return null;
    }, [checks]);

    return (
        <div className="viagens-ficha-top">
            <TripCalendarCard
                startsOn={draft.startsOn}
                endsOn={draft.endsOn}
                payload={draft.payload}
                destinations={destinations}
                nextTaskDayKey={nextTaskDayKey}
                scenarioCount={scenarioCount}
                onOpenSimulador={onOpenSimulador}
            />
            <TripResumoPanel
                trip={trip}
                draft={draft}
                destinations={destinations}
                financeMovements={financeMovements}
                tripCofrinhoMeta={tripCofrinhoMeta}
            />
            <TripChecklistPanel checks={checks} documents={documents} onPatch={onPatch} />
        </div>
    );
}
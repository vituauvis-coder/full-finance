import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    groundTransportRoteiroStats,
    newGroundTransport,
    normalizeGroundTransports
} from '../../domain/ground-transport';
import type { TripDestination, TripGroundTransport, TripPayload } from '../../types';
import type { TripDraft } from '../ViagemFicha';
import { TerrestreResumo } from './TerrestreResumo';
import { TerrestreTicketCard } from './TerrestreTicketCard';
import { TransporteTerrestreEditorModal } from './TransporteTerrestreEditorModal';

type Props = {
    draft: TripDraft;
    payload: TripPayload;
    destinations: TripDestination[];
    onChange: (mutate: TripGroundTransport[] | ((prev: TripGroundTransport[]) => TripGroundTransport[])) => void;
    /** Liga o botão do header da página ao fluxo de novo registro. */
    registerAddRef?: MutableRefObject<(() => void) | null>;
    showResumo?: boolean;
};

function formatDay(iso?: string) {
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TransporteTerrestrePanel({
    draft,
    payload,
    destinations,
    onChange,
    registerAddRef,
    showResumo = false
}: Props) {
    const rows = useMemo(() => normalizeGroundTransports(payload), [payload]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const destOptions = useMemo(
        () => destinations.map((d) => ({ id: d.id, label: d.name })),
        [destinations]
    );
    const destLabel = useMemo(() => new Map(destOptions.map((d) => [d.id, d.label])), [destOptions]);
    const roteiroStatsById = useMemo(() => {
        const map = new Map<string, ReturnType<typeof groundTransportRoteiroStats>>();
        for (const row of rows) {
            map.set(row.id, groundTransportRoteiroStats(payload, row.id));
        }
        return map;
    }, [payload, rows]);

    const editing = rows.find((r) => r.id === editingId) ?? null;
    const terrestreTotal = rows.reduce((s, r) => s + Math.max(0, Number(r.amount ?? 0) || 0), 0);
    const defaultDestId = destinations.find((d) => d.isPrincipal)?.id ?? destinations[0]?.id ?? null;

    function persist(mutate: TripGroundTransport[] | ((prev: TripGroundTransport[]) => TripGroundTransport[])) {
        onChange(mutate);
    }

    const openNew = useCallback(() => {
        const row = newGroundTransport({ tripDestinationId: defaultDestId });
        onChange((prev) => [...prev, row]);
        setEditingId(row.id);
    }, [defaultDestId, onChange]);

    useEffect(() => {
        if (!registerAddRef) return;
        registerAddRef.current = openNew;
        return () => {
            if (registerAddRef.current === openNew) registerAddRef.current = null;
        };
    }, [registerAddRef, openNew]);

    function patchRow(id: string, next: TripGroundTransport) {
        persist((prev) => prev.map((r) => (r.id === id ? next : r)));
    }

    function removeRow(id: string) {
        persist((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) setEditingId(null);
    }

    return (
        <>
            {showResumo ? (
                <TerrestreResumo draft={draft} terrestreTotal={terrestreTotal} count={rows.length} />
            ) : null}

            <section className="terrestre-registry" aria-label="Transportes terrestres">
                {rows.length === 0 ? (
                    <div className="terrestre-empty">
                        <div className="terrestre-empty__art" aria-hidden>
                            <MaterialIcon name="confirmation_number" variant="app" opticalSize={48} />
                        </div>
                        <p>Nenhum bilhete ainda.</p>
                        <button type="button" className="voos-text-btn" onClick={() => openNew()}>
                            Criar primeiro registro
                        </button>
                    </div>
                ) : (
                    <ul className="terrestre-ticket-grid">
                        {rows.map((row) => {
                            const dest = row.tripDestinationId ?? row.trip_destination_id;
                            const destName = dest ? destLabel.get(dest) ?? null : null;
                            const when = formatDay(row.departedOn ?? row.departed_on);
                            const stats = roteiroStatsById.get(row.id) ?? { uses: 0, totalAmount: 0 };
                            return (
                                <li key={row.id}>
                                    <TerrestreTicketCard
                                        row={row}
                                        destName={destName}
                                        when={when}
                                        roteiroUses={stats.uses}
                                        roteiroTotal={stats.totalAmount}
                                        onOpen={() => setEditingId(row.id)}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <TransporteTerrestreEditorModal
                open={Boolean(editing)}
                item={editing}
                destOptions={destOptions}
                onClose={() => setEditingId(null)}
                onChange={(next) => patchRow(next.id, next)}
                onDelete={() => editing && removeRow(editing.id)}
            />
        </>
    );
}
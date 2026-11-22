import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    buildChinaRouteLegs,
    chinaRouteStops,
    reorderChinaRoute,
    resolveChinaRouteOrder,
    writeChinaRouteOrder
} from '../../domain/chinaCityRoute';
import { mapPlaceCardTitle } from './roteiros-display';
import type { TripDestination, TripPayload } from '../../types';

type Props = {
    destinations: TripDestination[];
    payload: TripPayload;
    onPatchPayload: (update: (payload: TripPayload) => TripPayload) => void;
    selectedLegId: string | null;
    onSelectLeg: (legId: string | null) => void;
    /** Conteúdo dentro do modal (sem borda duplicada / sem título extra). */
    inModal?: boolean;
};

export function RoteirosChinaRoutePanel({
    destinations,
    payload,
    onPatchPayload,
    selectedLegId,
    onSelectLeg,
    inModal = false
}: Props) {
    const { order, anchorId, poolSize } = useMemo(
        () => resolveChinaRouteOrder(destinations, payload),
        [destinations, payload]
    );
    const stops = useMemo(() => chinaRouteStops(order, destinations), [order, destinations]);
    const legs = useMemo(() => buildChinaRouteLegs(order, destinations), [order, destinations]);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    if (poolSize < 2) return null;

    const persistOrder = (next: string[]) => {
        onPatchPayload((p) => writeChinaRouteOrder(p, next));
        onSelectLeg(null);
    };

    const move = (from: number, to: number) => {
        const next = reorderChinaRoute(order, from, to, anchorId);
        if (next.join('|') !== order.join('|')) persistOrder(next);
    };

    return (
        <section
            className={['rote-china-route', inModal ? 'rote-china-route--in-modal' : ''].filter(Boolean).join(' ')}
            aria-label="Rota entre cidades na China"
        >
            {inModal ? (
                <p className="rote-china-route__hint rote-china-route__hint--solo">
                    Arraste para ordenar. O aeroporto de chegada fica sempre como #1.
                </p>
            ) : (
                <header className="rote-china-route__head">
                    <h3 className="rote-china-route__title">
                        <MaterialIcon name="route" variant="app" opticalSize={16} />
                        Rota China
                    </h3>
                    <p className="rote-china-route__hint">
                        Arraste para ordenar. O aeroporto de chegada fica sempre como #1.
                    </p>
                </header>
            )}
            <ol className="rote-china-route__list">
                {stops.map((dest, index) => {
                    const locked = Boolean(anchorId && dest.id === anchorId);
                    return (
                        <li
                            key={dest.id}
                            className={[
                                'rote-china-route__item',
                                locked ? 'rote-china-route__item--locked' : '',
                                dragIdx === index ? 'rote-china-route__item--drag' : ''
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            draggable={!locked}
                            onDragStart={() => !locked && setDragIdx(index)}
                            onDragEnd={() => setDragIdx(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                                if (dragIdx == null || dragIdx === index) return;
                                move(dragIdx, index);
                                setDragIdx(null);
                            }}
                        >
                            <span className="rote-china-route__num" aria-hidden>
                                {index + 1}
                            </span>
                            <span className="rote-china-route__name">{mapPlaceCardTitle(dest)}</span>
                            <div className="rote-china-route__actions">
                                {!locked && index > 1 ? (
                                    <button
                                        type="button"
                                        className="rote-china-route__act"
                                        aria-label="Subir"
                                        onClick={() => move(index, index - 1)}
                                    >
                                        <MaterialIcon name="arrow_upward" variant="app" opticalSize={14} />
                                    </button>
                                ) : null}
                                {!locked && index < stops.length - 1 && index > 0 ? (
                                    <button
                                        type="button"
                                        className="rote-china-route__act"
                                        aria-label="Descer"
                                        onClick={() => move(index, index + 1)}
                                    >
                                        <MaterialIcon name="arrow_downward" variant="app" opticalSize={14} />
                                    </button>
                                ) : null}
                                {locked ? (
                                    <span className="rote-china-route__lock" title="Chegada no aeroporto">
                                        <MaterialIcon name="lock" variant="app" opticalSize={13} />
                                    </span>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ol>
            {legs.length > 0 ? (
                <ul className="rote-china-route__legs">
                    {legs.map((leg) => (
                        <li key={leg.id}>
                            <button
                                type="button"
                                className={[
                                    'rote-china-route__leg',
                                    selectedLegId === leg.id ? 'rote-china-route__leg--on' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                onClick={() => onSelectLeg(selectedLegId === leg.id ? null : leg.id)}
                            >
                                <span>
                                    {leg.fromLabel} → {leg.toLabel}
                                </span>
                                <span className="rote-china-route__leg-meta">
                                    {leg.compare.km} km · trem {leg.compare.train.durationLabel}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
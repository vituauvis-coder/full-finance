import { useEffect } from 'react';
import type { Trip } from '../types';
import { AtlasTripCard } from './AtlasTripCard';
import { useOpenNewTrip } from '../hooks/useOpenNewTrip';

type Props = {
    trips: Trip[];
    focusedTripId?: string | null;
};

/** Coluna lateral da home: milhas + viagens (layout dashboard). */
export function ViagensTrilho({ trips, focusedTripId = null }: Props) {
    const { openNewTrip, busy } = useOpenNewTrip();

    useEffect(() => {
        if (!focusedTripId) return;
        const el = document.getElementById(`atlas-trip-card-${focusedTripId}`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [focusedTripId]);

    return (
        <aside
            className="viagens-casa__trail viagens-trilho atlas-sidebar-panel atlas-trips-panel"
            aria-label="Trilho de viagens"
        >
            <div className="viagens-trail-header atlas-sidebar-panel__head">
                <h2 className="atlas-sidebar-panel__title">Suas viagens</h2>
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost viagens-trail-new"
                    disabled={busy}
                    onClick={() => void openNewTrip()}
                >
                    Nova
                </button>
            </div>
            <div className="viagens-trail-scroll">
                {trips.length === 0 ? (
                    <p className="viagens-trail-empty">A primeira viagem nasce aqui</p>
                ) : (
                    trips.map((trip) => (
                        <AtlasTripCard
                            key={trip.id}
                            trip={trip}
                            mapFocused={focusedTripId != null && focusedTripId === trip.id}
                        />
                    ))
                )}
            </div>
        </aside>
    );
}
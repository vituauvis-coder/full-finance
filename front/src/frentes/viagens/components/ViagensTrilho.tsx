import type { Trip } from '../types';
import { TripTicketCard } from './TripTicketCard';
import { useOpenNewTrip } from '../hooks/useOpenNewTrip';

type Props = {
    trips: Trip[];
};

/** Coluna lateral da home: Suas viagens + bilhetes (layout Meu Mundo). */
export function ViagensTrilho({ trips }: Props) {
    const { openNewTrip, busy } = useOpenNewTrip();

    return (
        <aside className="viagens-casa__trail" aria-label="Trilho de viagens">
            <div className="viagens-trail-header">
                <h2>Viagens</h2>
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost viagens-trail-new"
                    disabled={busy}
                    onClick={() => void openNewTrip()}
                >
                    Nova viagem
                </button>
            </div>
            <div className="viagens-trail-scroll">
                {trips.length === 0 ? (
                    <p className="viagens-trail-empty">A primeira viagem nasce aqui</p>
                ) : (
                    trips.map((trip, i) => (
                        <div key={trip.id} className="viagens-trail-item" style={{ animationDelay: `${i * 0.06}s` }}>
                            <TripTicketCard trip={trip} />
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
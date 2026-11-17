import type { Trip } from '../types';
import { TripTicketCard } from './TripTicketCard';
import './ViagensTrilho.css';

type Props = {
    trips: Trip[];
};

/** Coluna lateral do Atlas: lista de bilhetes. */
export function ViagensTrilho({ trips }: Props) {
    return (
        <aside className="viagens-casa__trail viagens-trilho" aria-label="Trilho de viagens">
            {trips.length === 0 ? (
                <p className="viagens-trilho__empty">Nenhuma passagem ainda. Crie uma viagem para gerar o primeiro bilhete.</p>
            ) : (
                <ul className="viagens-trilho__list">
                    {trips.map((trip) => (
                        <li key={trip.id}>
                            <TripTicketCard trip={trip} />
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
import type { TripDestination, TripStay } from '../../types';
import { sortStaysChronologically } from './hospedagens-display';
import { HospedagensLodgingCard } from './HospedagensLodgingCard';

type Props = {
    stays: TripStay[];
    destinations: TripDestination[];
    destLabelById: Map<string, string>;
    focusStayId?: string | null;
    onFocus: (id: string) => void;
    onEdit: (stay: TripStay) => void;
    onDelete: (id: string) => void;
    onTogglePaid: (id: string, paid: boolean) => void;
};

export function HospedagensLodgingList({
    stays,
    destinations,
    destLabelById,
    focusStayId,
    onFocus,
    onEdit,
    onDelete,
    onTogglePaid
}: Props) {
    const destById = new Map(destinations.map((d) => [d.id, d]));
    const ordered = sortStaysChronologically(stays);

    return (
        <div className="hosp-lodge-feed hosp-lodge-feed--grid" role="list" aria-label="Suas reservas">
            {ordered.map((stay, index) => (
                <HospedagensLodgingCard
                    key={stay.id}
                    stay={stay}
                    index={index}
                    destLabel={destLabelById.get(stay.destinationId ?? '') ?? ''}
                    destById={destById}
                    focused={focusStayId === stay.id}
                    onOpen={() => {
                        onFocus(stay.id);
                        onEdit(stay);
                    }}
                    onTogglePaid={() => onTogglePaid(stay.id, !stay.paid)}
                    onDelete={() => {
                        if (window.confirm('Apagar esta reserva?')) onDelete(stay.id);
                    }}
                />
            ))}
        </div>
    );
}
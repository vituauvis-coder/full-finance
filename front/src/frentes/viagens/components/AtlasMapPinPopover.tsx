import type { TripStatus } from '../types';
import { tripTicketStatusLabel } from './tripTicketModel';
import { formatBRL } from '../utils/map-utils';

export type AtlasMapPinPopoverModel = {
    id: string;
    placeName: string;
    tripTitle: string;
    status: TripStatus | string;
    monthYear?: string;
    itineraryDay?: string;
    activity?: string;
    citySpent?: number;
    tripTotal?: number;
};

type Props = AtlasMapPinPopoverModel & {
    onOpenTrip: () => void;
};

export function AtlasMapPinPopover({
    id,
    placeName,
    tripTitle,
    status,
    monthYear,
    itineraryDay,
    activity,
    citySpent,
    tripTotal,
    onOpenTrip
}: Props) {
    const statusKey =
        status === 'em_curso' || status === 'realizada' || status === 'planejada'
            ? status
            : 'planejada';
    const spentLine =
        typeof citySpent === 'number' && citySpent > 0
            ? `Nesta cidade ${formatBRL(citySpent)}`
            : typeof tripTotal === 'number' && tripTotal > 0
              ? `Viagem ${formatBRL(tripTotal)}`
              : null;

    return (
        <div
            id={id}
            className="atlas-map-pop"
            role="tooltip"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <header className="atlas-map-pop__head">
                <strong className="atlas-map-pop__place">{placeName}</strong>
                <span className={`atlas-map-pop__status atlas-map-pop__status--${statusKey}`}>
                    {tripTicketStatusLabel(statusKey)}
                </span>
            </header>
            <p className="atlas-map-pop__trip">{tripTitle}</p>
            {itineraryDay ? <p className="atlas-map-pop__meta">{itineraryDay}</p> : null}
            {activity ? (
                <p className="atlas-map-pop__meta atlas-map-pop__meta--activity">{activity}</p>
            ) : null}
            {monthYear ? <p className="atlas-map-pop__meta atlas-map-pop__meta--muted">{monthYear}</p> : null}
            {spentLine ? <p className="atlas-map-pop__spent">{spentLine}</p> : null}
            <button type="button" className="atlas-map-pop__cta" onClick={onOpenTrip}>
                Abrir ficha
            </button>
        </div>
    );
}
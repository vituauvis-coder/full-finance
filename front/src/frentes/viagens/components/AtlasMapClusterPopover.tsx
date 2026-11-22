import type { MapVisit } from '../types';
import { tripTicketStatusLabel } from './tripTicketModel';

type Props = {
    visits: MapVisit[];
    onOpenTrip: (tripId: string) => void;
};

function uniqueVisitsByTrip(visits: MapVisit[]): MapVisit[] {
    const seen = new Set<string>();
    const out: MapVisit[] = [];
    for (const v of visits) {
        if (seen.has(v.tripId)) continue;
        seen.add(v.tripId);
        out.push(v);
        if (out.length >= 5) break;
    }
    return out;
}

export function AtlasMapClusterPopover({ visits, onOpenTrip }: Props) {
    const rows = uniqueVisitsByTrip(visits);
    const extra = new Set(visits.map((v) => v.tripId)).size - rows.length;

    return (
        <div className="atlas-map-cluster-pop" role="tooltip">
            <p className="atlas-map-cluster-pop__title">{visits.length} paradas aqui</p>
            <ul className="atlas-map-cluster-pop__list">
                {rows.map((v) => {
                    const statusKey =
                        v.status === 'em_curso' || v.status === 'realizada' || v.status === 'planejada'
                            ? v.status
                            : 'planejada';
                    return (
                        <li key={v.tripId}>
                            <button
                                type="button"
                                className="atlas-map-cluster-pop__row"
                                onClick={() => onOpenTrip(v.tripId)}
                            >
                                <span className="atlas-map-cluster-pop__trip">{v.tripTitle}</span>
                                <span
                                    className={`atlas-map-cluster-pop__status atlas-map-cluster-pop__status--${statusKey}`}
                                >
                                    {tripTicketStatusLabel(statusKey)}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {extra > 0 ? (
                <p className="atlas-map-cluster-pop__more">+{extra} viagem{extra === 1 ? '' : 'ens'}</p>
            ) : null}
        </div>
    );
}
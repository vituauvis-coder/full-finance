import type { VisitHover } from '../types';
import { formatBRL } from '../utils/map-utils';

type Props = {
    hover: VisitHover;
};

export function HoverTicket({ hover }: Props) {
    return (
        <div className="viagens-ticket" role="tooltip">
            <h4>{hover.placeName}</h4>
            <p>{hover.tripTitle}</p>
            {hover.monthYear ? <p className="viagens-muted">{hover.monthYear}</p> : null}
            <p>nesta cidade {formatBRL(hover.citySpent)}</p>
            <p>viagem {formatBRL(hover.tripTotal)}</p>
        </div>
    );
}
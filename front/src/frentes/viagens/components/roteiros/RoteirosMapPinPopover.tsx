import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripItineraryDay } from '../../types';
import { placeKindLabel } from './roteiros-display';
import { mapPinLabelForDestination } from '../../utils/map-utils';

type Props = {
    dest: TripDestination;
    activityCount: number;
    canRemove: boolean;
    stayDistanceLabel?: string | null;
    onEdit?: () => void;
    onRemove: () => void;
};

export function RoteirosMapPinPopover({
    dest,
    activityCount,
    canRemove,
    stayDistanceLabel,
    onEdit,
    onRemove
}: Props) {
    const title = mapPinLabelForDestination(dest);
    const highlights = (dest.guideHighlights ?? []).slice(0, 4);
    const alerts = (dest.guideAlerts ?? []).slice(0, 2);
    const summary = dest.guideSummary?.trim();
    const isStay = String(dest.id).startsWith('rote-stay-') || dest.kind === 'lodging';

    return (
        <div className="rote-pin-pop" aria-label={`Pin ${title}`}>
            <header className="rote-pin-pop__head">
                <strong className="rote-pin-pop__title">{title}</strong>
                <span className="rote-pin-pop__kind">{isStay ? 'Hospedagem' : placeKindLabel(dest)}</span>
            </header>
            {dest.country ? <p className="rote-pin-pop__meta">{dest.country}</p> : null}
            {dest.neighborhood ? (
                <p className="rote-pin-pop__meta rote-pin-pop__meta--sub">{dest.neighborhood}</p>
            ) : null}
            {dest.arrivedOn || dest.departedOn ? (
                <p className="rote-pin-pop__dates">
                    {dest.arrivedOn ? `Chegada ${dest.arrivedOn}` : ''}
                    {dest.arrivedOn && dest.departedOn ? ' · ' : ''}
                    {dest.departedOn ? `Saída ${dest.departedOn}` : ''}
                </p>
            ) : null}
            {stayDistanceLabel ? (
                <p className="rote-pin-pop__dist">
                    <MaterialIcon name="near_me" variant="app" opticalSize={14} />
                    {stayDistanceLabel}
                </p>
            ) : null}
            {summary ? <p className="rote-pin-pop__summary">{summary}</p> : null}
            {highlights.length > 0 ? (
                <ul className="rote-pin-pop__list">
                    {highlights.map((h) => (
                        <li key={h}>{h}</li>
                    ))}
                </ul>
            ) : null}
            {alerts.length > 0 ? (
                <ul className="rote-pin-pop__list rote-pin-pop__list--alert">
                    {alerts.map((a) => (
                        <li key={a}>{a}</li>
                    ))}
                </ul>
            ) : null}
            {activityCount > 0 ? (
                <p className="rote-pin-pop__acts">
                    <MaterialIcon name="event_note" variant="app" opticalSize={14} />
                    {activityCount} atividade{activityCount === 1 ? '' : 's'} no roteiro
                </p>
            ) : null}
            {onEdit || canRemove ? (
                <div className="rote-pin-pop__actions" role="group" aria-label="Ações">
                    {onEdit ? (
                        <button
                            type="button"
                            className="rote-pin-pop__btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                        >
                            <MaterialIcon name="edit" variant="app" opticalSize={16} />
                            Editar
                        </button>
                    ) : null}
                    {canRemove ? (
                        <button
                            type="button"
                            className="rote-pin-pop__btn rote-pin-pop__btn--danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                        >
                            <MaterialIcon name="delete" variant="app" opticalSize={16} />
                            Excluir
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function countItineraryActivitiesForDest(days: TripItineraryDay[], destId: string): number {
    let n = 0;
    for (const day of days) {
        if (day.destinationId === destId) n += 1;
        for (const item of day.items ?? []) {
            if (item.destinationId === destId) n += 1;
        }
    }
    return n;
}

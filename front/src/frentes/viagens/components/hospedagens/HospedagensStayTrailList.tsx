import { stayAirportInsight } from '@motor/viagens/stay-logistics.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripPayload, TripStay } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import {
    HOSP_PIN_TINTS,
    sortStaysChronologically,
    stayDisplayCity,
    stayDisplayTitle,
    stayNights,
    stayPeriodPinLabel,
    stayCheckIn,
    stayCheckOut
} from './hospedagens-display';
import { formatTripDayShort } from '../../utils/tripCalendar';

type Props = {
    stays: TripStay[];
    destinations: TripDestination[];
    tripCtx: { payload: TripPayload };
    destLabelById: Map<string, string>;
    focusStayId?: string | null;
    onFocus: (id: string) => void;
    onEdit: (stay: TripStay) => void;
    onDelete: (id: string) => void;
    onTogglePaid: (id: string, paid: boolean) => void;
};

export function HospedagensStayTrailList({
    stays,
    destinations,
    tripCtx,
    destLabelById,
    focusStayId,
    onFocus,
    onEdit,
    onDelete,
    onTogglePaid
}: Props) {
    const destById = new Map(destinations.map((d) => [d.id, d]));
    const ordered = sortStaysChronologically(stays);

    if (ordered.length === 0) return null;

    return (
        <ol className="hosp-trail-list" aria-label="Trilha de reservas">
            {ordered.map((stay, index) => {
                const tint = HOSP_PIN_TINTS[index % HOSP_PIN_TINTS.length];
                const focused = focusStayId === stay.id;
                const paid = Boolean(stay.paid);
                const title = stayDisplayTitle(stay);
                const city = stayDisplayCity(stay, destById) || stay.city?.trim() || '';
                const destLabel = destLabelById.get(stay.destinationId ?? '') ?? '';
                const checkIn = stayCheckIn(stay);
                const checkOut = stayCheckOut(stay);
                const nights = stayNights(stay);
                const hasPin = stay.latitude != null && stay.longitude != null;
                const insight = stayAirportInsight(tripCtx, stay);
                const legLive = focusStayId
                    ? ordered.findIndex((s) => s.id === focusStayId) >= index
                    : true;

                return (
                    <li key={stay.id} className={`hosp-trail-list__step${focused ? ' is-focus' : ''}`}>
                        {index > 0 ? (
                            <div className={`hosp-trail-list__leg${legLive ? ' is-live' : ''}`} aria-hidden>
                                <span className="hosp-trail-list__leg-icon">
                                    <MaterialIcon name="apartment" variant="app" opticalSize={12} />
                                </span>
                            </div>
                        ) : null}
                        <article
                            className={`hosp-trail-list__item hosp-trail-list__item--${tint}${paid ? ' is-paid' : ''}`}
                        >
                            <div className="hosp-trail-list__rail" aria-hidden>
                                <span className="hosp-trail-list__pin">
                                    <MaterialIcon name="apartment" variant="app" opticalSize={17} filled />
                                </span>
                            </div>
                            <button
                                type="button"
                                className="hosp-trail-list__main"
                                onClick={() => {
                                    onFocus(stay.id);
                                    onEdit(stay);
                                }}
                            >
                                <div className="hosp-trail-list__top">
                                    <strong className="hosp-trail-list__title">{title}</strong>
                                    <span className="hosp-trail-list__period">{stayPeriodPinLabel(stay)}</span>
                                </div>
                                <div className="hosp-trail-list__meta">
                                    {destLabel ? (
                                        <span>
                                            <MaterialIcon name="pin_drop" variant="app" opticalSize={13} />
                                            {destLabel}
                                        </span>
                                    ) : null}
                                    {city ? (
                                        <span>
                                            <MaterialIcon name="location_city" variant="app" opticalSize={13} />
                                            {city}
                                        </span>
                                    ) : null}
                                    <span>
                                        <MaterialIcon name="calendar_month" variant="app" opticalSize={13} />
                                        {checkIn && checkOut
                                            ? `${formatTripDayShort(checkIn)} → ${formatTripDayShort(checkOut)}`
                                            : 'Datas em aberto'}
                                    </span>
                                    {nights != null ? (
                                        <span className="is-turquesa">
                                            <MaterialIcon name="nights_stay" variant="app" opticalSize={13} />
                                            {nights} {nights === 1 ? 'noite' : 'noites'}
                                        </span>
                                    ) : null}
                                    <span className={hasPin ? 'is-turquesa' : ''}>
                                        <MaterialIcon
                                            name={hasPin ? 'location_on' : 'add_location_alt'}
                                            variant="app"
                                            opticalSize={13}
                                        />
                                        {hasPin ? 'Mapa' : 'Sem pin'}
                                    </span>
                                </div>
                                {insight.hint ? (
                                    <p className="hosp-trail-list__hint">
                                        <MaterialIcon name="flight_land" variant="app" opticalSize={12} />
                                        {insight.hint}
                                    </p>
                                ) : null}
                                <p className="hosp-trail-list__cost">
                                    <MaterialIcon name="payments" variant="app" opticalSize={13} />
                                    {formatBRL(stay.amount ?? 0)}
                                </p>
                            </button>
                            <div className="hosp-trail-list__tools">
                                <button
                                    type="button"
                                    className={`voos-choose voos-choose--dense${paid ? ' is-on' : ''}`}
                                    aria-pressed={paid}
                                    onClick={() => onTogglePaid(stay.id, !paid)}
                                >
                                    {paid ? 'Pago' : 'Pagar'}
                                </button>
                                <button
                                    type="button"
                                    className="voos-icon-btn voos-icon-btn--coral"
                                    title="Apagar"
                                    onClick={() => {
                                        if (window.confirm('Apagar esta hospedagem?')) onDelete(stay.id);
                                    }}
                                >
                                    <MaterialIcon name="delete" variant="app" opticalSize={15} />
                                </button>
                            </div>
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}
import { stayAirportInsight } from '@motor/viagens/stay-logistics.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripPayload, TripStay } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { stayDisplayTitle, stayNights } from './hospedagens-display';
import { formatTripDayShort } from '../../utils/tripCalendar';

type Props = {
    stay: TripStay;
    destLabel: string;
    tripCtx: { payload: TripPayload };
    highlighted?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onTogglePaid: () => void;
};

export function HospedagemStayCard({
    stay,
    destLabel,
    tripCtx,
    highlighted,
    onEdit,
    onDelete,
    onTogglePaid
}: Props) {
    const paid = Boolean(stay.paid);
    const title = stayDisplayTitle(stay);
    const nights = stayNights(stay);
    const checkIn = stay.checkInOn ?? stay.check_in_on;
    const checkOut = stay.checkOutOn ?? stay.check_out_on;
    const hasPin = stay.latitude != null && stay.longitude != null;
    const insight = stayAirportInsight(tripCtx, stay);

    return (
        <article
            className={[
                'voos-sim-card',
                'voos-sim-card--list',
                'hosp-stay-card',
                paid ? 'voos-sim-card--chosen' : '',
                highlighted ? 'hosp-stay-card--focus' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <header className="voos-sim-card__head">
                <span className="hosp-stay-card__glyph" aria-hidden>
                    <MaterialIcon name="apartment" variant="app" opticalSize={18} filled />
                </span>
                <button
                    type="button"
                    className={`voos-choose${paid ? ' is-on' : ''}`}
                    aria-pressed={paid}
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePaid();
                    }}
                >
                    {paid ? 'Pago' : 'A pagar'}
                </button>
                <span className="voos-sim-card__spacer" />
                <button
                    type="button"
                    className="voos-icon-btn voos-icon-btn--coral"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    title="Apagar"
                >
                    <MaterialIcon name="delete" variant="app" opticalSize={16} />
                </button>
            </header>
            <div
                className="voos-sim-card__body"
                onClick={onEdit}
                onKeyDown={(e) => e.key === 'Enter' && onEdit()}
                role="button"
                tabIndex={0}
            >
                <strong className="voos-sim-card__title">{title}</strong>
                <ul className="hosp-stay-card__metrics" aria-label="Resumo visual">
                    <li className={hasPin ? 'is-ok' : ''}>
                        <MaterialIcon name={hasPin ? 'location_on' : 'add_location_alt'} variant="app" opticalSize={16} />
                        <span>{hasPin ? 'No mapa' : 'Sem pin'}</span>
                    </li>
                    <li>
                        <MaterialIcon name="calendar_month" variant="app" opticalSize={16} />
                        <span>
                            {checkIn && checkOut
                                ? `${formatTripDayShort(checkIn)} → ${formatTripDayShort(checkOut)}`
                                : 'Datas em aberto'}
                        </span>
                    </li>
                    {nights != null ? (
                        <li className="is-turquesa">
                            <MaterialIcon name="nights_stay" variant="app" opticalSize={16} />
                            <span>
                                {nights} {nights === 1 ? 'noite' : 'noites'}
                            </span>
                        </li>
                    ) : null}
                    {destLabel ? (
                        <li>
                            <MaterialIcon name="pin_drop" variant="app" opticalSize={16} />
                            <span>{destLabel}</span>
                        </li>
                    ) : null}
                </ul>
                {insight.hint ? (
                    <p className="hosp-stay-card__insight">
                        <MaterialIcon name="flight_land" variant="app" opticalSize={14} />
                        {insight.hint}
                    </p>
                ) : null}
                <p className="voos-sim-card__cost">
                    <span>
                        <MaterialIcon name="payments" variant="app" opticalSize={14} /> Total
                    </span>
                    <strong>{formatBRL(stay.amount ?? 0)}</strong>
                </p>
            </div>
        </article>
    );
}
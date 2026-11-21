import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripStay } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import {
    lodgeDateParts,
    lodgeKindLabel,
    stayCheckIn,
    stayCheckOut,
    stayDisplayCity,
    stayDisplayTitle,
    stayHasDisplayTitle,
    stayNights
} from './hospedagens-display';

const VISUAL_VARIANTS = ['ocean', 'sunset', 'dune', 'garden'] as const;

type Props = {
    stay: TripStay;
    index: number;
    destLabel: string;
    destById: Map<string, TripDestination>;
    focused?: boolean;
    onOpen: () => void;
    onTogglePaid: () => void;
    onDelete: () => void;
};

export function HospedagensLodgingCard({
    stay,
    index,
    destLabel,
    destById,
    focused,
    onOpen,
    onTogglePaid,
    onDelete
}: Props) {
    const paid = Boolean(stay.paid);
    const title = stayDisplayTitle(stay);
    const hasTitle = stayHasDisplayTitle(stay);
    const city = stayDisplayCity(stay, destById);
    const checkIn = stayCheckIn(stay);
    const checkOut = stayCheckOut(stay);
    const hasDates = Boolean(checkIn || checkOut);
    const nights = stayNights(stay);
    const variant = VISUAL_VARIANTS[index % VISUAL_VARIANTS.length];
    const kind = lodgeKindLabel(stay);
    const cityLabel = city.trim() || destLabel.trim();
    const address = stay.address?.trim();
    const amount = stay.amount ?? 0;
    const showPayStrip = paid || amount > 0;
    const showPrice = paid || amount > 0;
    const showKind = hasTitle || Boolean(cityLabel || address);

    return (
        <article
            className={[
                'hosp-lodge-card',
                `hosp-lodge-card--${variant}`,
                paid ? 'hosp-lodge-card--paid' : '',
                focused ? 'hosp-lodge-card--focus' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <button type="button" className="hosp-lodge-card__open" onClick={onOpen}>
                <div className="hosp-lodge-card__cover" aria-hidden>
                    <span className="hosp-lodge-card__cover-blob hosp-lodge-card__cover-blob--a" />
                    <span className="hosp-lodge-card__cover-blob hosp-lodge-card__cover-blob--b" />
                    <span className="hosp-lodge-card__cover-icon">
                        <MaterialIcon name="king_bed" variant="app" opticalSize={40} filled />
                    </span>
                    <span className="hosp-lodge-card__index">{index + 1}</span>
                    {showKind ? <span className="hosp-lodge-card__kind">{kind}</span> : null}
                    <span className={`hosp-lodge-card__badge${paid ? ' hosp-lodge-card__badge--paid' : ''}`}>
                        {paid ? 'Pago' : 'Reservado'}
                    </span>
                    {cityLabel ? (
                        <div className="hosp-lodge-card__loc" title={cityLabel}>
                            <span className="hosp-lodge-card__loc-pin" aria-hidden>
                                <MaterialIcon name="location_city" variant="app" opticalSize={18} filled />
                            </span>
                            <span className="hosp-lodge-card__loc-name">{cityLabel}</span>
                        </div>
                    ) : null}
                </div>

                <div className="hosp-lodge-card__content">
                    <header className="hosp-lodge-card__head">
                        <h3 className="hosp-lodge-card__name">{hasTitle ? title : 'Nova reserva'}</h3>
                        {address ? <p className="hosp-lodge-card__address">{address}</p> : null}
                    </header>

                    {hasDates ? (
                        <StayBookingBlock checkIn={checkIn} checkOut={checkOut} nights={nights} />
                    ) : null}

                    {showPrice || showPayStrip ? (
                        <StayMetaRow showPrice={showPrice} amount={amount} paid={paid} showPayStrip={showPayStrip} />
                    ) : null}

                    <span className="hosp-lodge-card__foot-spacer" aria-hidden />
                </div>
            </button>

            <div className="hosp-lodge-card__toolbar">
                <button
                    type="button"
                    className={`hosp-lodge-card__pay${paid ? ' is-paid' : ''}`}
                    onClick={onTogglePaid}
                >
                    <MaterialIcon
                        name={paid ? 'check_circle' : 'radio_button_unchecked'}
                        variant="app"
                        opticalSize={16}
                    />
                    {paid ? 'Pago' : 'Marcar pago'}
                </button>
                <button type="button" className="hosp-lodge-card__edit" onClick={onOpen}>
                    <MaterialIcon name="edit" variant="app" opticalSize={15} />
                    Detalhes
                </button>
                <button type="button" className="hosp-lodge-card__delete" onClick={onDelete} aria-label="Excluir">
                    <MaterialIcon name="delete_outline" variant="app" opticalSize={18} />
                </button>
            </div>
        </article>
    );
}

function StayBookingBlock({
    checkIn,
    checkOut,
    nights
}: {
    checkIn: string;
    checkOut: string;
    nights: number | null;
}) {
    const inParts = lodgeDateParts(checkIn);
    const outParts = lodgeDateParts(checkOut);
    const nightsLabel =
        nights != null ? `${nights} ${nights === 1 ? 'noite' : 'noites'}` : null;

    return (
        <section className="hosp-lodge-card__voucher" aria-label="Período da reserva">
            <div className="hosp-lodge-card__voucher-ticket">
                <VoucherSide tone="in" kicker="Check-in" icon="login" parts={inParts} />
                <div className="hosp-lodge-card__voucher-notch" aria-hidden={!nightsLabel}>
                    {nightsLabel ? (
                        <span className="hosp-lodge-card__voucher-stamp">
                            <MaterialIcon name="nights_stay" variant="app" opticalSize={12} />
                            {nightsLabel}
                        </span>
                    ) : null}
                </div>
                <VoucherSide tone="out" kicker="Check-out" icon="logout" parts={outParts} alignEnd />
            </div>
        </section>
    );
}

function VoucherSide({
    tone,
    kicker,
    icon,
    parts,
    alignEnd
}: {
    tone: 'in' | 'out';
    kicker: string;
    icon: 'login' | 'logout';
    parts: ReturnType<typeof lodgeDateParts>;
    alignEnd?: boolean;
}) {
    return (
        <div
            className={[
                'hosp-lodge-card__voucher-side',
                `hosp-lodge-card__voucher-side--${tone}`,
                alignEnd ? 'is-end' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span className="hosp-lodge-card__voucher-kicker">
                <MaterialIcon name={icon} variant="app" opticalSize={12} />
                {kicker}
            </span>
            {parts ? (
                <p className="hosp-lodge-card__voucher-when">
                    <span className="hosp-lodge-card__voucher-week">{parts.week}</span>
                    <strong>
                        {parts.day}
                        <small>{parts.month}</small>
                    </strong>
                </p>
            ) : (
                <p className="hosp-lodge-card__voucher-when is-empty">
                    <strong>—</strong>
                </p>
            )}
        </div>
    );
}

function StayMetaRow({
    showPrice,
    amount,
    paid,
    showPayStrip
}: {
    showPrice: boolean;
    amount: number;
    paid: boolean;
    showPayStrip: boolean;
}) {
    return (
        <div className="hosp-lodge-card__meta">
            <div className="hosp-lodge-card__meta-inner">
                {showPrice ? (
                    <div className="hosp-lodge-card__price">
                        <div className="hosp-lodge-card__price-head">
                            <span className="hosp-lodge-card__price-label">Total</span>
                            {showPayStrip ? <PayStatusChip paid={paid} /> : null}
                        </div>
                        <strong className="hosp-lodge-card__price-value">{formatBRL(amount)}</strong>
                    </div>
                ) : showPayStrip ? (
                    <PayStatusChip paid={paid} large />
                ) : null}
            </div>
        </div>
    );
}

function PayStatusChip({ paid, large }: { paid: boolean; large?: boolean }) {
    return (
        <span
            className={[
                'hosp-lodge-card__pay-chip',
                paid ? 'is-done' : '',
                large ? 'is-standalone' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <MaterialIcon name={paid ? 'verified' : 'payments'} variant="app" opticalSize={12} />
            {paid ? 'Quitado' : 'A pagar'}
        </span>
    );
}
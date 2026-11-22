import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { Trip } from '../../types';
import { CountryFlag } from '../CountryFlag';
import {
    tripTicketCountries,
    tripTicketRef,
    tripTicketRoute,
    tripTicketStatus,
    tripTicketStatusLabel,
    tripTicketTitle
} from '../tripTicketModel';
import { useAtlasTripCountdown } from '../../hooks/useAtlasTripCountdown';

type Props = {
    trip: Trip;
};

function CapBar({ fraction }: { fraction: number }) {
    const over = fraction > 1;
    const pct = Math.min(100, fraction * 100);
    return (
        <div
            className="viagens-cap-bar viagens-atlas-trip__cap"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-label="Uso do orçamento por categoria"
        >
            <div
                className={`viagens-cap-bar__fill${over ? ' viagens-cap-bar__fill--over' : ''}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

function CountdownMetric({ value, label }: { value: number; label: string }) {
    return (
        <div className="viagens-atlas-trip__metric">
            <span className="viagens-atlas-trip__metric-value">{String(value).padStart(2, '0')}</span>
            <span className="viagens-atlas-trip__metric-label">{label}</span>
        </div>
    );
}

export function TripAtlasCard({ trip }: Props) {
    const navigate = useNavigate();
    const status = tripTicketStatus(trip);
    const title = tripTicketTitle(trip);
    const route = tripTicketRoute(trip);
    const countries = tripTicketCountries(trip);
    const ref = tripTicketRef(trip);
    const { signLine, parts } = useAtlasTripCountdown(trip);

    const openTrip = useCallback(() => {
        if (!trip.id) return;
        navigate(`/viagens/${trip.id}`);
    }, [navigate, trip.id]);

    return (
        <article className="viagens-atlas-trip">
            <button type="button" className="viagens-atlas-trip__main" onClick={openTrip} aria-label={`Abrir viagem ${title}`}>
                <header className="viagens-atlas-trip__head">
                    <span className={`viagens-atlas-trip__status viagens-atlas-trip__status--${status}`}>
                        {tripTicketStatusLabel(status)}
                    </span>
                    <span className="viagens-atlas-trip__ref" aria-hidden>
                        {ref}
                    </span>
                </header>
                <div className="viagens-atlas-trip__title-row">
                    <span className="viagens-atlas-trip__icon" aria-hidden>
                        <MaterialIcon name="flight_takeoff" variant="app" opticalSize={22} />
                    </span>
                    <h3 className="viagens-atlas-trip__title">{title}</h3>
                </div>
                {countries.length > 0 ? (
                    <div className="viagens-atlas-trip__flags" aria-label={`Países: ${countries.join(', ')}`}>
                        {countries.map((c) => (
                            <CountryFlag key={c} label={c} size="ticket" className="country-flag country-flag--ticket" />
                        ))}
                    </div>
                ) : null}
                {route ? (
                    <p className="viagens-atlas-trip__route">
                        <span className="viagens-atlas-trip__route-kicker">Rota</span>
                        <span className="viagens-atlas-trip__route-text">{route}</span>
                    </p>
                ) : null}
                <CapBar fraction={trip.capUsedFraction ?? 0} />
            </button>
            {parts ? (
                <div className="viagens-atlas-trip__countdown" aria-live="polite">
                    <p className="viagens-atlas-trip__countdown-kicker">{signLine}</p>
                    <div className="viagens-atlas-trip__metrics">
                        <CountdownMetric value={parts.days} label="Dias" />
                        <CountdownMetric value={parts.hours} label="Horas" />
                        <CountdownMetric value={parts.minutes} label="Min" />
                        <CountdownMetric value={parts.seconds} label="Seg" />
                    </div>
                </div>
            ) : null}
        </article>
    );
}
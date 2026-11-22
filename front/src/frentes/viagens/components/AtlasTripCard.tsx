import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trip } from '../types';
import {
    tripTicketCountries,
    tripTicketRoute,
    tripTicketStatus,
    tripTicketStatusLabel,
    tripTicketTitle
} from './tripTicketModel';
import { CountryFlag } from './CountryFlag';
import { useAtlasTripCountdown } from '../hooks/useAtlasTripCountdown';

type Props = {
    trip: Trip;
    mapFocused?: boolean;
};

function CapBar({ fraction }: { fraction: number }) {
    const over = fraction > 1;
    const pct = Math.min(100, fraction * 100);
    return (
        <div
            className="viagens-cap-bar atlas-trip-card__cap"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-label="Uso do orçamento"
        >
            <div
                className={`viagens-cap-bar__fill${over ? ' viagens-cap-bar__fill--over' : ''}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

/** Card compacto no estilo dashboard (home Viagens). */
export function AtlasTripCard({ trip, mapFocused = false }: Props) {
    const navigate = useNavigate();
    const status = tripTicketStatus(trip);
    const title = tripTicketTitle(trip);
    const route = tripTicketRoute(trip);
    const countries = tripTicketCountries(trip);
    const { parts, signLine, target, active } = useAtlasTripCountdown(trip);

    const openTrip = useCallback(() => {
        if (!trip.id) return;
        navigate(`/viagens/${trip.id}`);
    }, [navigate, trip.id]);

    const countdownLine =
        target != null && parts
            ? `${parts.days}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s`
            : null;

    return (
        <button
            type="button"
            id={trip.id ? `atlas-trip-card-${trip.id}` : undefined}
            className={`atlas-trip-card${mapFocused ? ' atlas-trip-card--map-focus' : ''}`}
            data-status={status}
            aria-label={`Abrir viagem ${title}`}
            onClick={openTrip}
        >
            <div className="atlas-trip-card__top">
                <span className={`atlas-trip-card__status atlas-trip-card__status--${status}`}>
                    {tripTicketStatusLabel(status)}
                </span>
                {countries.length > 0 ? (
                    <div className="atlas-trip-card__flags" aria-label={`Países: ${countries.join(', ')}`}>
                        {countries.map((c) => (
                            <CountryFlag
                                key={c}
                                label={c}
                                size="ticket"
                                className="country-flag country-flag--ticket"
                            />
                        ))}
                    </div>
                ) : null}
            </div>

            <h3 className="atlas-trip-card__title">{title}</h3>

            {route ? (
                <p className="atlas-trip-card__route" title={route}>
                    {route}
                </p>
            ) : null}

            <CapBar fraction={trip.capUsedFraction ?? 0} />

            {active && countdownLine ? (
                <div className="atlas-trip-card__foot">
                    <span className="atlas-trip-card__foot-label">{signLine}</span>
                    <time className="atlas-trip-card__countdown" dateTime={new Date(target!).toISOString()}>
                        {countdownLine}
                    </time>
                </div>
            ) : null}
        </button>
    );
}
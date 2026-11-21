import { atlasHomeCountdownItems } from '@motor/viagens/atlas-home-countdown.js';
import { addDays, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Trip } from '../types';
import '../styles/viagens-flip-clock.css';

const LABELS: [string, string, string, string] = ['Dias', 'Horas', 'Min', 'Seg'];

function countdownTimestamp(
    active: ReturnType<typeof atlasHomeCountdownItems>[number]
): number | null {
    const endsOn = active.endsOn?.trim().slice(0, 10) ?? '';
    const startsOn = active.startsOn?.trim().slice(0, 10) ?? '';

    if (active.mode === 'until_end' && endsOn) {
        const end = parseDayKey(endsOn);
        if (!end) return null;
        return addDays(end, 1).getTime();
    }
    if (startsOn) {
        if (!parseDayKey(startsOn)) return null;
        return startOfDayInLifeOS(startsOn).getTime();
    }
    return null;
}

type Props = {
    trip: Trip;
};

export function ViagemTripCountdown({ trip }: Props) {
    const active = useMemo(() => {
        const items = atlasHomeCountdownItems([trip]);
        return items[0] ?? null;
    }, [trip]);

    const target = active ? countdownTimestamp(active) : null;
    if (!active || target == null) return null;

    const signLine =
        active.status === 'em_curso' || active.mode === 'until_end'
            ? 'Sua viagem termina em'
            : 'Sua viagem será em';

    const aria =
        active.daysRemaining === 0
            ? `${trip.title}: viagem hoje`
            : active.daysRemaining != null
              ? `${trip.title}: ${signLine.toLowerCase()} ${active.daysRemaining} dias`
              : `${trip.title}: ${signLine.toLowerCase()}`;

    return (
        <div className="viagens-trail-countdown-hang">
            <Link
                to={`/viagens/${trip.id}`}
                className="viagens-trail-countdown viagens-trail-countdown__plate"
                aria-label={aria}
            >
                <div className="viagens-trail-countdown__sign" aria-hidden>
                    <span className="viagens-trail-countdown__sign-plaque">{signLine}</span>
                </div>
                <div className="viagens-trail-countdown__scroll">
                    <div className="viagens-flip-clock viagens-trail-countdown__clock">
                        <FlipClockCountdown
                            key={`${trip.id}-${target}`}
                            to={target}
                            labels={LABELS}
                            className="viagens-flip-clock__widget"
                            hideOnComplete={false}
                            stopOnHiddenVisibility
                            duration={0.55}
                            spacing={{ clock: 5, digitBlock: 3 }}
                        />
                    </div>
                </div>
            </Link>
        </div>
    );
}
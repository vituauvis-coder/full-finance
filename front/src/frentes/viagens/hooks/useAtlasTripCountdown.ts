import { atlasHomeCountdownItems } from '@motor/viagens/atlas-home-countdown.js';
import { addDays, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';
import { useEffect, useMemo, useState } from 'react';
import type { Trip } from '../types';

type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

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

function partsUntil(targetMs: number, now = Date.now()): CountdownParts {
    const diff = Math.max(0, targetMs - now);
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return { days, hours, minutes, seconds };
}

export function useAtlasTripCountdown(trip: Trip) {
    const active = useMemo(() => {
        const items = atlasHomeCountdownItems([trip]);
        return items[0] ?? null;
    }, [trip]);

    const target = active ? countdownTimestamp(active) : null;

    const [parts, setParts] = useState<CountdownParts | null>(() =>
        target != null ? partsUntil(target) : null
    );

    useEffect(() => {
        if (target == null) {
            setParts(null);
            return;
        }
        const tick = () => setParts(partsUntil(target));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [target]);

    const signLine =
        active?.status === 'em_curso' || active?.mode === 'until_end'
            ? 'Termina em'
            : 'Começa em';

    return { active, target, parts, signLine };
}
import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripStay } from '../../types';
import {
    HOSP_PIN_TINTS,
    sortStaysChronologically,
    stayDisplayCity,
    stayDisplayTitle,
    stayPeriodPinLabel
} from './hospedagens-display';

type Props = {
    stays: TripStay[];
    destinations: TripDestination[];
    focusStayId?: string | null;
    onFocusStay?: (id: string | null) => void;
};

export function HospedagensStayTrail({ stays, destinations, focusStayId, onFocusStay }: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const destById = useMemo(() => new Map(destinations.map((d) => [d.id, d])), [destinations]);
    const ordered = useMemo(() => sortStaysChronologically(stays), [stays]);

    const pinned =
        (focusStayId ? ordered.find((s) => s.id === focusStayId) : null) ??
        (hoveredId ? ordered.find((s) => s.id === hoveredId) : null) ??
        ordered[0] ??
        null;

    const focusIdx = pinned ? ordered.findIndex((s) => s.id === pinned.id) : -1;

    if (ordered.length === 0) {
        return (
            <div className="hosp-trail-empty">
                <MaterialIcon name="apartment" variant="app" opticalSize={28} />
                <p className="voos-muted">Cadastre hospedagens para ver a trilha por período.</p>
            </div>
        );
    }

    return (
        <div className="hosp-trail viagens-sim-destinos">
            <div
                className="viagens-sim-rota-rail hosp-trail__rail"
                style={{ ['--sim-rota-n' as string]: String(Math.max(ordered.length, 2)) }}
                role="list"
                aria-label="Trilha de hospedagens"
                onMouseLeave={() => setHoveredId(null)}
            >
                {ordered.map((stay, index) => {
                    const tint = HOSP_PIN_TINTS[index % HOSP_PIN_TINTS.length];
                    const isPinned =
                        focusStayId === stay.id || (focusIdx === index && !hoveredId && !focusStayId);
                    const isHovered = hoveredId === stay.id;
                    const isLive = isHovered || isPinned || focusStayId === stay.id;
                    const legLive = index === 0 ? focusIdx >= 0 : focusIdx >= index;
                    const city = stayDisplayCity(stay, destById) || stay.city?.trim() || '';

                    return (
                        <StayTrailSegment
                            key={stay.id}
                            index={index}
                            tint={tint}
                            period={stayPeriodPinLabel(stay)}
                            title={stayDisplayTitle(stay)}
                            sub={city}
                            isLive={isLive}
                            isHovered={isHovered}
                            isPinned={focusStayId === stay.id || isPinned}
                            legLive={legLive}
                            onHover={() => setHoveredId(stay.id)}
                            onBlur={() => setHoveredId(null)}
                            onToggle={() => onFocusStay?.(focusStayId === stay.id ? null : stay.id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function StayTrailSegment({
    index,
    tint,
    period,
    title,
    sub,
    isLive,
    isHovered,
    isPinned,
    legLive,
    onHover,
    onBlur,
    onToggle
}: {
    index: number;
    tint: (typeof HOSP_PIN_TINTS)[number];
    period: string;
    title: string;
    sub: string;
    isLive: boolean;
    isHovered: boolean;
    isPinned: boolean;
    legLive: boolean;
    onHover: () => void;
    onBlur: () => void;
    onToggle: () => void;
}) {
    return (
        <>
            {index > 0 ? (
                <div className={`viagens-sim-rota-rail__leg${legLive ? ' is-live' : ''}`} aria-hidden>
                    <span className="viagens-sim-rota-rail__leg-track">
                        <span className="viagens-sim-rota-rail__leg-glow" />
                    </span>
                    <span className="viagens-sim-rota-rail__leg-icon">
                        <MaterialIcon name="apartment" variant="app" opticalSize={14} />
                    </span>
                </div>
            ) : null}
            <button
                type="button"
                role="listitem"
                className={`viagens-sim-rota-rail__node viagens-sim-rota-rail__node--${tint}${isLive ? ' is-on' : ''}${isHovered ? ' is-hover' : ''}`}
                style={{ ['--node-i' as string]: String(index + 1) }}
                onMouseEnter={onHover}
                onFocus={onHover}
                onBlur={onBlur}
                onClick={onToggle}
                aria-pressed={isPinned}
            >
                <span className="viagens-sim-rota-rail__ring" aria-hidden />
                <span className="viagens-sim-rota-rail__pin" aria-hidden>
                    <MaterialIcon name="apartment" variant="app" opticalSize={18} />
                </span>
                <span className="viagens-sim-rota-rail__label">{title}</span>
                <span className="viagens-sim-rota-rail__sub">{sub ? `${sub} · ${period}` : period}</span>
            </button>
        </>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { cityForCountry, countryStayPinLabel, type CountryRow } from '../../domain/tripScenarioDisplay';
import { hopCountry, type TripTimeHop } from '../../domain/tripTimeScenario';
import type { ScenarioSnapshot } from '../../domain/tripScenarioCriteria';

type Props = {
    rows: CountryRow[];
    hops: TripTimeHop[];
    snapshot: ScenarioSnapshot;
    focusedCountry: string | null;
    onCountry: (country: string | null) => void;
};

const PIN_TINTS = ['coral', 'oceano', 'turquesa', 'ouro', 'coral'] as const;
const ROTA_ORIGIN_LABEL = 'Recife';
const ROTA_ORIGIN_SUB = '(BR)';

function countriesInHopOrder(hops: TripTimeHop[], rows: CountryRow[]): CountryRow[] {
    const map = new Map(rows.map((r) => [r.country, r]));
    const ordered: CountryRow[] = [];
    const seen = new Set<string>();
    for (const hop of hops) {
        const country = hopCountry(hop);
        if (!country || country === 'Brasil' || seen.has(country)) continue;
        seen.add(country);
        const row = map.get(country);
        if (row) ordered.push(row);
    }
    for (const row of rows) {
        if (!seen.has(row.country)) ordered.push(row);
    }
    return ordered;
}

type LugarProps = {
    row: CountryRow;
    hops: TripTimeHop[];
    remoteInCountry: number;
    preview?: boolean;
};

function TripRotaSegment({
    row,
    index,
    tint,
    daysPin,
    isLive,
    isHovered,
    isPinned,
    legLive,
    onHover,
    onBlur,
    onToggle
}: {
    row: CountryRow;
    index: number;
    tint: (typeof PIN_TINTS)[number];
    daysPin: string;
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
            <div className={`viagens-sim-rota-rail__leg${legLive ? ' is-live' : ''}`} aria-hidden>
                <span className="viagens-sim-rota-rail__leg-track">
                    <span className="viagens-sim-rota-rail__leg-glow" />
                </span>
                <span className="viagens-sim-rota-rail__leg-icon">
                    <MaterialIcon name="flight" variant="app" opticalSize={14} />
                </span>
            </div>
            <button
                type="button"
                role="listitem"
                className={`viagens-sim-rota-rail__node viagens-sim-rota-rail__node--${tint}${isLive ? ' is-on' : ''}${isHovered ? ' is-hover' : ''}${row.isLayoverOnly ? ' is-transit' : ''}`}
                style={{ ['--node-i' as string]: String(index + 1) }}
                onMouseEnter={onHover}
                onFocus={onHover}
                onBlur={onBlur}
                onClick={onToggle}
                aria-pressed={isPinned}
            >
                <span className="viagens-sim-rota-rail__ring" aria-hidden />
                <span className="viagens-sim-rota-rail__pin" aria-hidden>
                    <MaterialIcon name="location_on" variant="app" opticalSize={18} />
                </span>
                <span className="viagens-sim-rota-rail__label">{row.country}</span>
                <span className="viagens-sim-rota-rail__sub">{daysPin}</span>
            </button>
        </>
    );
}

function LugarLegend({ row, hops, remoteInCountry, preview }: LugarProps) {
    const city = row.city ?? cityForCountry(hops, row.country);
    const stayLabel = countryStayPinLabel(row);
    return (
        <article
            className={`viagens-sim-lugar viagens-sim-lugar--strip${preview ? ' viagens-sim-lugar--preview' : ''}`}
            aria-live="polite"
        >
            <div className="viagens-sim-lugar__strip-main">
                <span className={`viagens-sim-lugar__dot${row.isLayoverOnly ? ' is-transit' : ''}`} aria-hidden />
                <strong>{row.country}</strong>
                <span className="viagens-sim-lugar__continent">{row.continent}</span>
            </div>
            <div className="viagens-sim-lugar__strip-metrics" aria-label="Resumo do destino">
                {city ? (
                    <span className="viagens-sim-lugar__metric" title="Cidade">
                        <MaterialIcon name="apartment" variant="app" opticalSize={13} />
                        {city}
                    </span>
                ) : null}
                <span className="viagens-sim-lugar__metric viagens-sim-lugar__metric--turquesa" title="Estadia">
                    <MaterialIcon name="calendar_month" variant="app" opticalSize={13} />
                    {stayLabel}
                </span>
                {remoteInCountry > 0 ? (
                    <span className="viagens-sim-lugar__metric viagens-sim-lugar__metric--ouro" title="Dias remotos">
                        <MaterialIcon name="laptop_mac" variant="app" opticalSize={13} />
                        {remoteInCountry} remoto{remoteInCountry === 1 ? '' : 's'}
                    </span>
                ) : null}
            </div>
        </article>
    );
}

export function TripSimuladorDestinosPanel({ rows, hops, snapshot, focusedCountry, onCountry }: Props) {
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

    const ordered = useMemo(() => countriesInHopOrder(hops, rows), [hops, rows]);
    const visit = ordered;

    useEffect(() => {
        if (visit.length === 0) return;
        if (focusedCountry && visit.some((r) => r.country === focusedCountry)) return;
        onCountry(visit[0].country);
    }, [visit, focusedCountry, onCountry]);

    const pinned =
        (focusedCountry ? visit.find((r) => r.country === focusedCountry) : null) ?? visit[0] ?? null;
    const hovered = hoveredCountry ? visit.find((r) => r.country === hoveredCountry) : null;
    const legendRow = hovered ?? pinned;

    const focusIdx = useMemo(() => {
        const key = hoveredCountry ?? pinned?.country;
        if (!key) return -1;
        return visit.findIndex((r) => r.country === key);
    }, [visit, hoveredCountry, pinned?.country]);

    const remoteByCountry = snapshot.remote?.byCountry ?? {};

    if (rows.length === 0) {
        return (
            <div className="viagens-sim-destinos viagens-sim-destinos--empty">
                <MaterialIcon name="route" variant="app" opticalSize={28} />
                <p className="viagens-muted">Cadastre trechos ou puxe voos da ficha para montar a rota.</p>
            </div>
        );
    }

    const rotaNodeCount = visit.length + 1;

    return (
        <div className="viagens-sim-destinos">
            <div
                className="viagens-sim-rota-rail viagens-sim-rota-rail--with-home"
                style={{ ['--sim-rota-n' as string]: String(Math.max(rotaNodeCount, 2)) }}
                role="list"
                aria-label="Saída e países na rota"
                onMouseLeave={() => setHoveredCountry(null)}
            >
                <div
                    className="viagens-sim-rota-rail__node viagens-sim-rota-rail__node--home"
                    role="presentation"
                    aria-hidden
                >
                    <span className="viagens-sim-rota-rail__pin" aria-hidden>
                        <MaterialIcon name="home" variant="app" opticalSize={17} filled />
                    </span>
                    <span className="viagens-sim-rota-rail__label">{ROTA_ORIGIN_LABEL}</span>
                    <span className="viagens-sim-rota-rail__sub">{ROTA_ORIGIN_SUB}</span>
                </div>

                {visit.map((row, index) => {
                    const tint = PIN_TINTS[index % PIN_TINTS.length];
                    const isPinned = pinned?.country === row.country;
                    const isHovered = hoveredCountry === row.country;
                    const isLive = isHovered || (isPinned && !hoveredCountry);
                    const daysPin = countryStayPinLabel(row);
                    const legLive =
                        index === 0
                            ? focusIdx >= 0 ||
                              hoveredCountry === row.country ||
                              (!hoveredCountry && !!pinned)
                            : focusIdx >= index ||
                              hoveredCountry === row.country ||
                              hoveredCountry === visit[index - 1]?.country ||
                              (!hoveredCountry && isPinned);

                    return (
                        <TripRotaSegment
                            key={row.id}
                            row={row}
                            index={index}
                            tint={tint}
                            daysPin={daysPin}
                            isLive={isLive}
                            isHovered={isHovered}
                            isPinned={isPinned}
                            legLive={legLive}
                            onHover={() => setHoveredCountry(row.country)}
                            onBlur={() => setHoveredCountry(null)}
                            onToggle={() => onCountry(isPinned ? null : row.country)}
                        />
                    );
                })}
            </div>

            {legendRow ? (
                <LugarLegend
                    row={legendRow}
                    hops={hops}
                    remoteInCountry={Number(remoteByCountry[legendRow.country] ?? 0) || 0}
                    preview={Boolean(hovered)}
                />
            ) : null}
        </div>
    );
}
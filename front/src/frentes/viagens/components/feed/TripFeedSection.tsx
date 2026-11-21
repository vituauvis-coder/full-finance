import { Fragment, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { brlToForeignAmount, formatForeignMoney } from '@motor/viagens/trip-country-travel.js';
import { formatClockInZone } from '@motor/viagens/trip-diary-feed.js';
import type { Trip } from '../../types';
import type { TripDraft } from '../ViagemFicha';
import {
    buildTripDiaryFeed,
    type TripDiaryDayEntry,
    type TripDiaryHighlight,
    type TripDiaryTimeTwin,
    type TripFeedCityPin
} from '../../domain/tripDiaryFeed';
import { useTaxFxQuotes } from '../../hooks/useTaxFxQuotes';
import { isCheckDone } from '../../domain/tripChecklistUtils';
import { formatBRL } from '../../utils/map-utils';
import '../../styles/viagens-simulador.css';
import '../../styles/trip-feed.css';

const PIN_TINTS = ['coral', 'oceano', 'turquesa', 'ouro', 'coral'] as const;

type Props = {
    trip: Trip;
    draft: TripDraft;
};

function FeedCountdownCard({ countdown }: { countdown: ReturnType<typeof buildTripDiaryFeed>['countdown'] }) {
    if (countdown.mode === 'done') {
        return (
            <div className="trip-feed__countdown trip-feed__countdown--done">
                <span className="trip-feed__countdown-icon" aria-hidden>
                    <MaterialIcon name="check_circle" variant="app" opticalSize={28} />
                </span>
                <span className="trip-feed__countdown-done-label">{countdown.label}</span>
            </div>
        );
    }

    const unit =
        countdown.days == null
            ? null
            : countdown.days === 1
              ? 'dia'
              : countdown.days === 0
                ? 'hoje'
                : 'dias';

    return (
        <div
            className={`trip-feed__countdown${countdown.mode === 'until_end' ? ' trip-feed__countdown--live' : ''}`}
            aria-live="polite"
        >
            <span className="trip-feed__countdown-eyebrow">
                <MaterialIcon
                    name={countdown.mode === 'until_end' ? 'flight_land' : 'flight_takeoff'}
                    variant="app"
                    opticalSize={14}
                />
                {countdown.label}
            </span>
            <div className="trip-feed__countdown-hero">
                {countdown.days != null ? (
                    <>
                        <strong className="trip-feed__countdown-days">{countdown.days}</strong>
                        {unit && unit !== 'hoje' ? (
                            <span className="trip-feed__countdown-unit">{unit}</span>
                        ) : null}
                    </>
                ) : (
                    <MaterialIcon name="hourglass_empty" variant="app" opticalSize={32} />
                )}
            </div>
            {countdown.suffix ? <span className="trip-feed__countdown-suffix">{countdown.suffix}</span> : null}
        </div>
    );
}

function FeedWorldClocks({ zones }: { zones: ReturnType<typeof buildTripDiaryFeed>['clocks'] }) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className="trip-feed__clocks" aria-label="Horários locais">
            {zones.map((z) => (
                <div key={z.id} className={`trip-feed__clock${z.id === 'home' ? ' trip-feed__clock--home' : ''}`}>
                    <span className="trip-feed__clock-ico" aria-hidden>
                        <MaterialIcon name="schedule" variant="app" opticalSize={16} />
                    </span>
                    <span className="trip-feed__clock-flag" aria-hidden>
                        {z.flag}
                    </span>
                    <div className="trip-feed__clock-meta">
                        <span className="trip-feed__clock-city">{z.label}</span>
                        <time className="trip-feed__clock-time">{formatClockInZone(now, z.timeZone)}</time>
                    </div>
                </div>
            ))}
        </div>
    );
}

function FeedCityTrail({ cities }: { cities: TripFeedCityPin[] }) {
    if (!cities.length) return null;

    const n = Math.max(cities.length, 2);
    return (
        <div className="trip-feed__trail trip-feed__trail--rota">
            <div
                className="viagens-sim-rota-rail trip-feed__rail"
                style={{ ['--sim-rota-n' as string]: String(n) }}
                role="list"
                aria-label="Locais do roteiro"
            >
                {cities.map((city, i) => (
                    <Fragment key={city.id}>
                        {i > 0 ? (
                            <div className="viagens-sim-rota-rail__leg is-live" aria-hidden>
                                <span className="viagens-sim-rota-rail__leg-track">
                                    <span className="viagens-sim-rota-rail__leg-glow" />
                                </span>
                                <span className="viagens-sim-rota-rail__leg-icon">
                                    <MaterialIcon name="route" variant="app" opticalSize={12} />
                                </span>
                            </div>
                        ) : null}
                        <div
                            className={`viagens-sim-rota-rail__node viagens-sim-rota-rail__node--${
                                PIN_TINTS[i % PIN_TINTS.length]
                            } trip-feed__rail-node`}
                            style={{ ['--node-i' as string]: String(i + 1) }}
                            role="listitem"
                        >
                            <span className="viagens-sim-rota-rail__ring" aria-hidden />
                            <span className="viagens-sim-rota-rail__pin" aria-hidden>
                                <MaterialIcon name="location_on" variant="app" opticalSize={16} />
                            </span>
                            <span className="viagens-sim-rota-rail__label">{city.name}</span>
                            {city.sub ? <span className="viagens-sim-rota-rail__sub">{city.sub}</span> : null}
                        </div>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

function DayBudget({
    day,
    rates
}: {
    day: TripDiaryDayEntry;
    rates: Record<string, number> | null | undefined;
}) {
    const hasAmount = day.budget.amount != null && Boolean(day.budget.formatted);
    const code = (day.currencyCode || 'BRL').toUpperCase();
    const showFx = code !== 'BRL';
    const fx = hasAmount && showFx ? brlToForeignAmount(day.budget.amount!, code, rates ?? undefined) : null;
    const foreign = fx && fx.code !== 'BRL' ? formatForeignMoney(fx.amount, fx.code) : null;
    const rate = showFx ? rates?.[code] : null;

    return (
        <div className={`trip-feed__budget${hasAmount ? '' : ' trip-feed__budget--empty'}`}>
            <div className="trip-feed__budget-top">
                <span className="trip-feed__budget-icon" aria-hidden>
                    <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={15} />
                </span>
                <span className="trip-feed__budget-kicker">Carteira</span>
            </div>
            {hasAmount ? (
                <>
                    <strong className="trip-feed__budget-brl">{day.budget.formatted}</strong>
                    {showFx ? (
                        <span className="trip-feed__budget-fx">{foreign ?? `— ${code}`}</span>
                    ) : null}
                    {showFx ? (
                        <span className="trip-feed__budget-rate">
                            {rate != null
                                ? `1 ${code} ≈ ${formatBRL(rate)}`
                                : `Moeda local: ${code}`}
                        </span>
                    ) : (
                        <span className="trip-feed__budget-rate">Real (BRL)</span>
                    )}
                </>
            ) : (
                <>
                    <strong className="trip-feed__budget-brl trip-feed__budget-brl--muted">—</strong>
                    <span className="trip-feed__budget-rate">Sem teto diário</span>
                </>
            )}
        </div>
    );
}

function HighlightTimes({ times }: { times: TripDiaryTimeTwin[] }) {
    return (
        <div className="trip-feed__hl-times" aria-label="Horários">
            {times.map((t, i) => (
                <Fragment key={`${t.role}-${t.label}`}>
                    {i > 0 ? <span className="trip-feed__hl-time-sep" aria-hidden>·</span> : null}
                    <span
                        className={`trip-feed__hl-time trip-feed__hl-time--${t.role}`}
                        data-tip={t.tip}
                        aria-label={t.tip}
                    >
                        <span className="trip-feed__hl-time-flag" aria-hidden>
                            {t.flag}
                        </span>
                        <time className="trip-feed__hl-time-hm" dateTime={t.hm}>
                            {t.hm}
                        </time>
                    </span>
                </Fragment>
            ))}
        </div>
    );
}

function highlightIcon(kind: TripDiaryHighlight['kind']): string {
    if (kind === 'flight') return 'flight_takeoff';
    if (kind === 'remote') return 'laptop_mac';
    if (kind === 'activity') return 'local_activity';
    return 'info';
}

function cityTagLabel(day: TripDiaryDayEntry): string {
    const place = day.placeName.trim();
    const country = day.countryLabel.trim();
    if (!place || place.toLowerCase() === country.toLowerCase()) return '';
    return place;
}

function FeedDayCard({
    day,
    rates
}: {
    day: TripDiaryDayEntry;
    rates: Record<string, number> | null | undefined;
}) {
    const dateLine = day.label
        ? (() => {
              const short = day.label.short.trim();
              const m = short.match(/^(\d+)\s+(.+)$/);
              const week = (day.label.week || '').replace(/\.$/, '');
              if (m) return `${week} ${m[1]} ${m[2]}`;
              return `${week} ${short}`.trim();
          })()
        : null;

    return (
        <article className={`trip-feed__day${day.isToday ? ' trip-feed__day--today' : ''}`} id={`trip-feed-day-${day.dayKey}`}>
            <header className="trip-feed__day-head">
                <div className="trip-feed__day-id">
                    <span className="trip-feed__day-badge">Dia {day.dayIndex}</span>
                    {dateLine ? (
                        <span className="trip-feed__day-date" title={day.label?.long}>
                            {dateLine}
                        </span>
                    ) : null}
                </div>
                {(() => {
                    const city = cityTagLabel(day);
                    return (
                        <span
                            className={[
                                'trip-feed__place-tag',
                                city ? '' : 'trip-feed__place-tag--flag-only'
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            title={city || day.countryLabel || undefined}
                        >
                            <span className="trip-feed__place-pin" aria-hidden>
                                <MaterialIcon name="location_on" variant="app" opticalSize={13} />
                            </span>
                            <span aria-hidden>{day.countryFlag || '📍'}</span>
                            {city ? <span>{city}</span> : null}
                        </span>
                    );
                })()}
                {day.isToday ? <span className="trip-feed__day-live">Hoje</span> : null}
            </header>

            <div className="trip-feed__day-body">
                <div className="trip-feed__day-main">
                    {day.highlights.length > 0 ? (
                        <ul className="trip-feed__highlights">
                            {day.highlights.map((h) => (
                                <li key={h.id} className={`trip-feed__hl trip-feed__hl--${h.kind}`}>
                                    <div
                                        className={`trip-feed__hl-row${h.times?.length ? ' trip-feed__hl-row--timed' : ''}`}
                                    >
                                        <span className="trip-feed__hl-icon" aria-hidden>
                                            <MaterialIcon name={highlightIcon(h.kind)} variant="app" opticalSize={14} />
                                        </span>
                                        <span className="trip-feed__hl-text">{h.text}</span>
                                        {h.times?.length ? (
                                            <>
                                                <span className="trip-feed__hl-dash" aria-hidden />
                                                <HighlightTimes times={h.times} />
                                            </>
                                        ) : null}
                                    </div>
                                    {h.sub ? <span className="trip-feed__hl-sub">{h.sub}</span> : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="trip-feed__day-empty">Sem atividades neste dia</p>
                    )}

                    {day.checklist.length > 0 ? (
                        <section className="trip-feed__checks" aria-label={`Checklist do dia ${day.dayIndex}`}>
                            <h3 className="trip-feed__checks-title">Checklist</h3>
                            <ul>
                                {day.checklist.map((c) => (
                                    <li key={c.id} className={isCheckDone(c) ? 'is-done' : undefined}>
                                        <MaterialIcon
                                            name={isCheckDone(c) ? 'check_circle' : 'radio_button_unchecked'}
                                            variant="app"
                                            opticalSize={14}
                                        />
                                        <span>{c.title?.trim() || 'Tarefa'}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </div>

                <aside className="trip-feed__day-aside">
                    <DayBudget day={day} rates={rates} />
                </aside>
            </div>
        </article>
    );
}

export function TripFeedSection({ trip, draft }: Props) {
    const feed = useMemo(() => buildTripDiaryFeed(draft, trip), [draft, trip]);
    const { quotes } = useTaxFxQuotes();
    const rates = quotes?.rates;

    if (!draft.startsOn || !draft.endsOn) return null;

    const dayRows: TripDiaryDayEntry[][] = [];
    for (let i = 0; i < feed.days.length; i += 2) {
        dayRows.push(feed.days.slice(i, i + 2));
    }

    return (
        <section className="trip-feed" aria-label="Diário da viagem">
            <div className="trip-feed__hub">
                <FeedCountdownCard countdown={feed.countdown} />
                <div className="trip-feed__hub-main">
                    <FeedCityTrail cities={feed.cityTrail} />
                    <FeedWorldClocks zones={feed.clocks} />
                </div>
            </div>

            <div className="trip-feed__diary" aria-label="Diário por dia">
                {dayRows.map((row, rowIdx) => (
                    <Fragment key={row[0]?.dayKey ?? rowIdx}>
                        <div className="trip-feed__day-row">
                            {row.map((day, colIdx) => (
                                <Fragment key={day.dayKey}>
                                    <FeedDayCard day={day} rates={rates} />
                                    {colIdx === 0 && row[1] ? (
                                        <div className="trip-feed__seq trip-feed__seq--across" aria-hidden>
                                            <span className="trip-feed__seq-line" />
                                            <span className="trip-feed__seq-icon">
                                                <MaterialIcon name="arrow_forward" variant="app" opticalSize={16} />
                                            </span>
                                            <span className="trip-feed__seq-line" />
                                        </div>
                                    ) : null}
                                </Fragment>
                            ))}
                        </div>
                        {rowIdx < dayRows.length - 1 ? (
                            <div className="trip-feed__seq trip-feed__seq--down" aria-hidden>
                                <span className="trip-feed__seq-line trip-feed__seq-line--vert" />
                                <span className="trip-feed__seq-icon">
                                    <MaterialIcon name="south" variant="app" opticalSize={16} />
                                </span>
                                <span className="trip-feed__seq-line trip-feed__seq-line--vert" />
                            </div>
                        ) : null}
                    </Fragment>
                ))}
            </div>
        </section>
    );
}

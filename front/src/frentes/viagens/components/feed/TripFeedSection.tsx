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
import '../../styles/viagens-dash-hero.css';
import '../../styles/trip-feed.css';

type Props = {
    trip: Trip;
    draft: TripDraft;
};

function FeedCountdownCard({ countdown }: { countdown: ReturnType<typeof buildTripDiaryFeed>['countdown'] }) {
    if (countdown.mode === 'done') {
        return (
            <div className="trip-feed__countdown trip-feed__countdown--done">
                <MaterialIcon name="check_circle" variant="app" opticalSize={22} />
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

    const stackLines =
        countdown.suffix &&
        countdown.days != null &&
        unit &&
        unit !== 'hoje' &&
        (countdown.mode === 'until_start' || countdown.mode === 'until_end');

    if (stackLines) {
        return (
            <div
                className={`trip-feed__countdown trip-feed__countdown--stack${
                    countdown.mode === 'until_end' ? ' trip-feed__countdown--live' : ''
                }`}
                aria-live="polite"
            >
                <p className="trip-feed__countdown-prelude">
                    <MaterialIcon
                        name={countdown.mode === 'until_end' ? 'flight_land' : 'flight_takeoff'}
                        variant="app"
                        opticalSize={14}
                    />
                    <span>{countdown.label}</span>
                </p>
                <p className="trip-feed__countdown-metric" aria-label={`${countdown.days} ${unit}`}>
                    <strong className="trip-feed__countdown-days">{countdown.days}</strong>
                    <span className="trip-feed__countdown-unit">{unit}</span>
                </p>
                <p className="trip-feed__countdown-tail">{countdown.suffix}</p>
            </div>
        );
    }

    const leadText = [countdown.label, countdown.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    return (
        <div
            className={`trip-feed__countdown${countdown.mode === 'until_end' ? ' trip-feed__countdown--live' : ''}`}
            aria-live="polite"
        >
            {leadText ? (
                <p className="trip-feed__countdown-copy">
                    <MaterialIcon
                        name={countdown.mode === 'until_end' ? 'flight_land' : 'flight_takeoff'}
                        variant="app"
                        opticalSize={14}
                    />
                    <span className="trip-feed__countdown-lead">{leadText}</span>
                </p>
            ) : null}
            <div className="trip-feed__countdown-metric">
                {countdown.days != null ? (
                    <>
                        <strong className="trip-feed__countdown-days">{countdown.days}</strong>
                        {unit && unit !== 'hoje' ? (
                            <span className="trip-feed__countdown-unit">{unit}</span>
                        ) : null}
                    </>
                ) : (
                    <MaterialIcon name="hourglass_empty" variant="app" opticalSize={28} />
                )}
            </div>
        </div>
    );
}

function FeedWorldClocks({ zones }: { zones: ReturnType<typeof buildTripDiaryFeed>['clocks'] }) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    if (!zones.length) return null;

    return (
        <div className="trip-feed__clocks" aria-label="Horários locais">
            {zones.map((z) => (
                <div key={z.id} className={`trip-feed__clock${z.id === 'home' ? ' trip-feed__clock--home' : ''}`}>
                    <span className="trip-feed__clock-flag" aria-hidden>
                        {z.flag}
                    </span>
                    <span className="trip-feed__clock-city">{z.label}</span>
                    <time className="trip-feed__clock-time">{formatClockInZone(now, z.timeZone)}</time>
                </div>
            ))}
        </div>
    );
}

function FeedCityTrail({ cities }: { cities: TripFeedCityPin[] }) {
    if (!cities.length) return null;

    return (
        <nav className="trip-feed__route" aria-label="Locais do roteiro">
            {cities.map((city, i) => (
                <Fragment key={city.id}>
                    {i > 0 ? (
                        <span className="trip-feed__route-sep" aria-hidden>
                            →
                        </span>
                    ) : null}
                    <span className="trip-feed__route-stop" title={city.sub || undefined}>
                        {city.name}
                    </span>
                </Fragment>
            ))}
        </nav>
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

    const rateLabel = !hasAmount
        ? 'Sem teto diário'
        : showFx
          ? rate != null
              ? `1 ${code} ≈ ${formatBRL(rate)}`
              : `Moeda local: ${code}`
          : 'Real (BRL)';

    return (
        <div
            className={`trip-feed__budget trip-feed__budget--card${hasAmount ? '' : ' trip-feed__budget--empty'}`}
        >
            <span className="trip-feed__budget-label">Carteira</span>
            <strong className={`trip-feed__budget-brl${hasAmount ? '' : ' trip-feed__budget-brl--muted'}`}>
                {hasAmount ? day.budget.formatted : '—'}
            </strong>
            {hasAmount && showFx ? (
                <span className="trip-feed__budget-fx">{foreign ?? `— ${code}`}</span>
            ) : null}
            <span className="trip-feed__budget-rate">{rateLabel}</span>
        </div>
    );
}

function HighlightTimes({ times, stacked }: { times: TripDiaryTimeTwin[]; stacked?: boolean }) {
    return (
        <div
            className={`trip-feed__hl-times${stacked ? ' trip-feed__hl-times--stacked' : ''}`}
            aria-label="Horários"
        >
            {times.map((t, i) => (
                <Fragment key={`${t.role}-${t.label}`}>
                    {i > 0 ? <span className="trip-feed__hl-time-sep" aria-hidden>→</span> : null}
                    <span
                        className={`trip-feed__hl-time trip-feed__hl-time--${t.role}`}
                        data-tip={t.tip}
                        aria-label={t.tip}
                    >
                        {!stacked ? (
                            <span className="trip-feed__hl-time-flag" aria-hidden>
                                {t.flag}
                            </span>
                        ) : null}
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

    const city = cityTagLabel(day);
    const where = city || day.countryLabel.trim() || '—';

    return (
        <article className={`trip-feed__day${day.isToday ? ' trip-feed__day--today' : ''}`} id={`trip-feed-day-${day.dayKey}`}>
            <header className="trip-feed__day-head">
                <h3 className="trip-feed__day-title">
                    <span className="trip-feed__day-index">Dia {day.dayIndex}</span>
                    {dateLine ? (
                        <>
                            <span className="trip-feed__day-sep" aria-hidden>
                                ·
                            </span>
                            <time className="trip-feed__day-date" title={day.label?.long}>
                                {dateLine}
                            </time>
                        </>
                    ) : null}
                </h3>
                <p className="trip-feed__day-where" title={where}>
                    <span aria-hidden>{day.countryFlag || ''}</span>
                    <span>{where}</span>
                </p>
                {day.isToday ? <span className="trip-feed__day-live">Hoje</span> : null}
            </header>

            <div className="trip-feed__day-panel">
                <div className="trip-feed__day-main">
                    {day.highlights.length > 0 ? (
                        <ul className="trip-feed__highlights">
                            {day.highlights.map((h) => (
                                <li key={h.id} className={`trip-feed__hl trip-feed__hl--${h.kind}`}>
                                    <div className="trip-feed__hl-row">
                                        <span className="trip-feed__hl-icon" aria-hidden>
                                            <MaterialIcon
                                                name={highlightIcon(h.kind)}
                                                variant="app"
                                                opticalSize={16}
                                            />
                                        </span>
                                        <div className="trip-feed__hl-copy">
                                            <span className="trip-feed__hl-text">{h.text}</span>
                                            {h.times?.length ? <HighlightTimes times={h.times} stacked /> : null}
                                            {h.sub ? <span className="trip-feed__hl-sub">{h.sub}</span> : null}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="trip-feed__day-empty">Sem atividades neste dia</p>
                    )}

                    {day.checklist.length > 0 ? (
                        <section className="trip-feed__checks" aria-label={`Checklist do dia ${day.dayIndex}`}>
                            <h4 className="trip-feed__checks-title">Checklist</h4>
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

                <aside className="trip-feed__day-aside" aria-label={`Carteira do dia ${day.dayIndex}`}>
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

    return (
        <section className="trip-feed" aria-label="Diário da viagem">
            <header className="viagens-hero trip-feed__hub">
                <FeedCountdownCard countdown={feed.countdown} />
                <div className="trip-feed__hub-body">
                    <div className="trip-feed__hub-inset">
                        <FeedCityTrail cities={feed.cityTrail} />
                        <FeedWorldClocks zones={feed.clocks} />
                    </div>
                </div>
            </header>

            <ol className="trip-feed__diary" aria-label="Diário por dia">
                {feed.days.map((day) => (
                    <li key={day.dayKey} className="trip-feed__diary-item">
                        <FeedDayCard day={day} rates={rates} />
                    </li>
                ))}
            </ol>
        </section>
    );
}
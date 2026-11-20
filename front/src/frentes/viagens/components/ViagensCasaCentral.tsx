import { unitLabel } from '@motor/milhas/catalog.js';
import { atlasHomeStatusSegments, atlasHomeTripStats } from '@motor/viagens/atlas-home-stats.js';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { fetchMilesDashboard } from '../api/miles';
import { saldoEmReais, totalSaldoEmReais } from '../domain/milhas-cmp';
import { formatPts, type MilesProgram } from '../pages/pontos/pontos-format';
import type { Trip } from '../types';
import { formatBRL } from '../utils/map-utils';
import '../styles/viagens-casa-central.css';

const STATUS_LABEL: Record<string, string> = {
    planejada: 'Planejadas',
    em_curso: 'Em curso',
    realizada: 'Realizadas'
};

type Props = {
    trips: Trip[];
};

export function ViagensCasaCentral({ trips }: Props) {
    const stats = useMemo(() => atlasHomeTripStats(trips), [trips]);
    const segments = useMemo(
        () => atlasHomeStatusSegments(stats.statusCounts, stats.totalTrips),
        [stats.statusCounts, stats.totalTrips]
    );
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [milesLoading, setMilesLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void fetchMilesDashboard()
            .then((data) => {
                if (cancelled) return;
                const list = (data as { programs?: MilesProgram[] }).programs ?? [];
                setPrograms(list);
            })
            .catch(() => {
                if (!cancelled) setPrograms([]);
            })
            .finally(() => {
                if (!cancelled) setMilesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const milesTotalPts = useMemo(
        () => programs.reduce((n, p) => n + Math.max(0, p.balance ?? 0), 0),
        [programs]
    );
    const milesTotalBrl = useMemo(() => totalSaldoEmReais(programs), [programs]);

    const barSummary = segments
        .filter((s) => s.count > 0)
        .map((s) => `${STATUS_LABEL[s.key]} ${s.count}`)
        .join(', ');

    return (
        <section className="viagens-casa-central" aria-label="Central visual">
            <header className="viagens-casa-central__toolbar">
                <div className="viagens-casa-central__brand">
                    <span className="viagens-casa-central__brand-icon" aria-hidden>
                        <MaterialIcon name="travel_explore" variant="app" filled opticalSize={22} />
                    </span>
                    <div>
                        <p className="viagens-casa-central__brand-kicker">Central visual</p>
                        <p className="viagens-casa-central__brand-sub">Carteiras de pontos e panorama das viagens</p>
                    </div>
                </div>
                <Link to="/viagens/milhas" className="viagens-btn viagens-casa-central__milhas-btn">
                    <MaterialIcon name="loyalty" variant="app" opticalSize={18} />
                    Central de milhas
                    <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                </Link>
            </header>

            <div className="viagens-casa-central__panels">
                <article className="viagens-casa-central__panel viagens-casa-central__panel--wallets">
                    <header className="viagens-casa-central__panel-head">
                        <h3>Carteiras</h3>
                        {!milesLoading && programs.length > 0 ? (
                            <p className="viagens-casa-central__panel-meta">
                                <strong>{formatPts(milesTotalPts)}</strong>
                                {milesTotalBrl != null ? (
                                    <span> · ≈ {formatBRL(milesTotalBrl)}</span>
                                ) : null}
                                <span> · {programs.length} programa{programs.length === 1 ? '' : 's'}</span>
                            </p>
                        ) : null}
                    </header>

                    <div className="viagens-casa-central__wallets-scroll" tabIndex={0}>
                        {milesLoading ? (
                            <p className="viagens-casa-central__hint">Carregando pontos…</p>
                        ) : programs.length === 0 ? (
                            <div className="viagens-casa-central__empty">
                                <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={28} />
                                <p>Nenhuma carteira cadastrada</p>
                                <Link to="/viagens/milhas" className="viagens-btn viagens-btn--ghost">
                                    Criar na central
                                </Link>
                            </div>
                        ) : (
                            programs.map((program) => {
                                const balance = Math.max(0, program.balance ?? 0);
                                const free = Math.max(0, program.available ?? balance);
                                const reserved = Math.max(0, program.committed ?? 0);
                                const brl = saldoEmReais(program);
                                const freePct = balance > 0 ? Math.min(100, Math.round((free / balance) * 100)) : 0;
                                return (
                                    <Link
                                        key={program.id}
                                        to="/viagens/milhas"
                                        className={[
                                            'viagens-casa-central__wallet',
                                            `pontos-wallet--${program.brand}`,
                                            `pontos-wallet--unit-${program.unit || 'pontos'}`
                                        ].join(' ')}
                                    >
                                        <span className="viagens-casa-central__wallet-brand" aria-hidden />
                                        <span className="viagens-casa-central__wallet-name" title={program.name}>
                                            {program.name}
                                        </span>
                                        <span className="viagens-casa-central__wallet-unit">
                                            {unitLabel(program.unit || 'pontos', 2)}
                                        </span>
                                        <strong className="viagens-casa-central__wallet-pts">{formatPts(balance)}</strong>
                                        <span className="viagens-casa-central__wallet-sub">
                                            {brl != null ? (
                                                <span className="viagens-casa-central__wallet-brl">≈ {formatBRL(brl)}</span>
                                            ) : null}
                                            <span className="viagens-casa-central__wallet-free">
                                                {reserved > 0
                                                    ? `${formatPts(free)} livres · ${formatPts(reserved)} reserv.`
                                                    : `${formatPts(free)} livres`}
                                            </span>
                                        </span>
                                        <span className="viagens-cap-bar viagens-casa-central__wallet-bar" aria-hidden>
                                            <span className="viagens-cap-bar__fill" style={{ width: `${freePct}%` }} />
                                        </span>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </article>

                <article className="viagens-casa-central__panel viagens-casa-central__panel--stats">
                    <header className="viagens-casa-central__panel-head">
                        <h3>Suas viagens</h3>
                    </header>

                    <dl className="viagens-casa-central__kpis">
                        <div className="viagens-casa-central__kpi">
                            <dt>Total</dt>
                            <dd>{stats.totalTrips}</dd>
                        </div>
                        <div className="viagens-casa-central__kpi">
                            <dt>Média</dt>
                            <dd>
                                {stats.averageDurationDays != null ? (
                                    <>
                                        {stats.averageDurationDays}
                                        <small>d</small>
                                    </>
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                        <div className="viagens-casa-central__kpi">
                            <dt>Destinos</dt>
                            <dd>{stats.destinationCount}</dd>
                        </div>
                    </dl>

                    <div
                        className="viagens-casa-central__bar"
                        role="img"
                        aria-label={barSummary || 'Nenhuma viagem cadastrada'}
                    >
                        {stats.totalTrips > 0 ? (
                            segments.map((seg) =>
                                seg.count > 0 ? (
                                    <span
                                        key={seg.key}
                                        className={`viagens-casa-central__bar-seg viagens-casa-central__bar-seg--${seg.key}`}
                                        style={{ flexGrow: seg.count }}
                                        title={`${STATUS_LABEL[seg.key]}: ${seg.count}`}
                                    />
                                ) : null
                            )
                        ) : (
                            <span className="viagens-casa-central__bar-empty" />
                        )}
                    </div>

                    <ul className="viagens-casa-central__chips" aria-label="Distribuição por status">
                        {stats.totalTrips > 0 ? (
                            segments
                                .filter((s) => s.count > 0)
                                .map((s) => (
                                    <li
                                        key={s.key}
                                        className={`viagens-casa-central__chip viagens-casa-central__chip--${s.key}`}
                                    >
                                        <span>{STATUS_LABEL[s.key]}</span>
                                        <strong>{s.count}</strong>
                                    </li>
                                ))
                        ) : (
                            <li className="viagens-casa-central__chip viagens-casa-central__chip--muted">
                                Crie a primeira viagem no trilho ao lado
                            </li>
                        )}
                    </ul>
                </article>
            </div>
        </section>
    );
}
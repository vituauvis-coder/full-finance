import { unitLabel } from '@motor/milhas/catalog.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMilesDashboard } from '../api/miles';
import { saldoEmReais } from '../domain/milhas-cmp';
import { formatPts, type MilesProgram } from '../pages/pontos/pontos-format';
import { formatBRL } from '../utils/map-utils';

export function ViagensCasaCentral() {
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

    return (
        <section className="atlas-sidebar-panel atlas-miles-panel" aria-label="Milhas e pontos">
            <div className="atlas-sidebar-panel__head">
                <h2 className="atlas-sidebar-panel__title">Milhas e pontos</h2>
                <Link to="/viagens/milhas" className="atlas-sidebar-panel__link">
                    Central
                </Link>
            </div>

            <div className="atlas-miles-panel__body">
                {milesLoading ? (
                    <p className="atlas-miles-panel__hint" aria-busy="true">
                        Carregando saldos…
                    </p>
                ) : programs.length === 0 ? (
                    <Link to="/viagens/milhas" className="atlas-miles-panel__cta">
                        Configurar carteiras
                    </Link>
                ) : (
                    <ul className="atlas-miles-panel__list">
                        {programs.map((program) => {
                            const balance = Math.max(0, program.balance ?? 0);
                            const brl = saldoEmReais(program);
                            const unit = unitLabel(program.unit || 'pontos', 2);
                            return (
                                <li key={program.id}>
                                    <Link
                                        to="/viagens/milhas"
                                        className={`atlas-miles-row atlas-miles-row--${program.brand}`}
                                        title={program.name}
                                    >
                                        <span className="atlas-miles-row__meta">
                                            <span className="atlas-miles-row__dot" aria-hidden />
                                            <span className="atlas-miles-row__text">
                                                <span className="atlas-miles-row__name">{program.name}</span>
                                                <span className="atlas-miles-row__unit">{unit}</span>
                                            </span>
                                        </span>
                                        <span className="atlas-miles-row__values">
                                            <strong className="atlas-miles-row__pts">{formatPts(balance)}</strong>
                                            {brl != null ? (
                                                <span className="atlas-miles-row__brl">≈ {formatBRL(brl)}</span>
                                            ) : null}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
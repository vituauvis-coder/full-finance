import { unitLabel } from '@motor/milhas/catalog.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { fetchMilesDashboard } from '../api/miles';
import { saldoEmReais } from '../domain/milhas-cmp';
import { formatPts, type MilesProgram } from '../pages/pontos/pontos-format';
import { formatBRL } from '../utils/map-utils';
import '../styles/viagens-casa-central.css';

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
        <section className="viagens-casa-central viagens-casa-central--compact" aria-label="Minhas milhas">
            <h2 className="viagens-casa-central__kicker">Minhas Milhas</h2>
            <div className="viagens-casa-central__compact-row">
                <div className="viagens-casa-central__wallets-scroll" tabIndex={0}>
                    {milesLoading ? (
                        <p className="viagens-casa-central__hint">…</p>
                    ) : programs.length === 0 ? (
                        <Link to="/viagens/milhas" className="viagens-casa-central__empty-chip">
                            <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={18} />
                            <span>Carteira</span>
                        </Link>
                    ) : (
                        programs.map((program) => {
                            const balance = Math.max(0, program.balance ?? 0);
                            const free = Math.max(0, program.available ?? balance);
                            const brl = saldoEmReais(program);
                            const freePct = balance > 0 ? Math.min(100, Math.round((free / balance) * 100)) : 0;
                            return (
                                <Link
                                    key={program.id}
                                    to="/viagens/milhas"
                                    className={[
                                        'viagens-casa-central__wallet',
                                        'viagens-casa-central__wallet--compact',
                                        `pontos-wallet--${program.brand}`,
                                        `pontos-wallet--unit-${program.unit || 'pontos'}`
                                    ].join(' ')}
                                    title={program.name}
                                >
                                    <span className="viagens-casa-central__wallet-brand" aria-hidden />
                                    <span className="viagens-casa-central__wallet-name">{program.name}</span>
                                    <strong className="viagens-casa-central__wallet-pts">{formatPts(balance)}</strong>
                                    {brl != null ? (
                                        <span className="viagens-casa-central__wallet-brl">≈ {formatBRL(brl)}</span>
                                    ) : null}
                                    <span className="viagens-cap-bar viagens-casa-central__wallet-bar" aria-hidden>
                                        <span className="viagens-cap-bar__fill" style={{ width: `${freePct}%` }} />
                                    </span>
                                    <span className="viagens-casa-central__wallet-unit">
                                        {unitLabel(program.unit || 'pontos', 2)}
                                    </span>
                                </Link>
                            );
                        })
                    )}
                </div>
                <Link
                    to="/viagens/milhas"
                    className="viagens-casa-central__milhas-btn viagens-casa-central__milhas-btn--icon"
                    aria-label="Central de milhas"
                    title="Central de milhas"
                >
                    <MaterialIcon name="loyalty" variant="app" opticalSize={20} />
                </Link>
            </div>
        </section>
    );
}
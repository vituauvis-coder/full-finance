import { unitLabel } from '@motor/milhas/catalog.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import { formatPts, type MilesProgram } from '../../pages/pontos/pontos-format';
import { programMilheiro, saldoEmReais } from '../../domain/milhas-cmp';

type Props = {
    programs: MilesProgram[];
    selectedId?: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
};

export function MilhasWalletRail({ programs, selectedId, onSelect, onCreate }: Props) {
    return (
        <aside className="milhas-casa__trail" aria-label="Carteiras de milhas">
            <header className="milhas-trail-header">
                <div className="milhas-trail-header__icon" aria-hidden>
                    <MaterialIcon name="loyalty" variant="app" filled opticalSize={22} />
                </div>
                <h2>Carteiras</h2>
                <button type="button" className="viagens-btn viagens-btn--ghost milhas-trail-new" onClick={onCreate}>
                    <MaterialIcon name="add" variant="app" opticalSize={18} />
                    Nova
                </button>
            </header>
            <div className="milhas-trail-scroll">
                {programs.length === 0 ? (
                    <div className="milhas-trail-empty">
                        <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={40} />
                        <p>A primeira carteira nasce aqui</p>
                        <button type="button" className="viagens-btn viagens-btn--coral" onClick={onCreate}>
                            Criar carteira
                        </button>
                    </div>
                ) : (
                    programs.map((program, index) => {
                        const on = selectedId === program.id;
                        const balance = Math.max(0, program.balance ?? 0);
                        const free = Math.max(0, program.available ?? balance);
                        const reserved = Math.max(0, program.committed ?? 0);
                        const freePct = balance > 0 ? Math.min(100, Math.round((free / balance) * 100)) : 0;
                        const cmp = programMilheiro(program);
                        const saldoBrl = saldoEmReais(program);
                        return (
                            <div
                                key={program.id}
                                className="milhas-trail-item"
                                style={{ animationDelay: `${index * 0.06}s` }}
                            >
                            <button
                                type="button"
                                className={[
                                    'carteira-mini',
                                    `pontos-wallet--${program.brand}`,
                                    `pontos-wallet--unit-${program.unit || 'pontos'}`,
                                    on ? 'is-on' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                style={{ ['--shine-delay' as string]: `${index * 0.55}s` }}
                                aria-current={on ? 'true' : undefined}
                                aria-label={`Selecionar ${program.name}`}
                                onClick={() => onSelect(program.id)}
                            >
                                <span className="carteira-mini__unit">{unitLabel(program.unit || 'pontos', 2)}</span>
                                <strong className="carteira-mini__saldo">{formatPts(balance)}</strong>
                                <span className="carteira-mini__name">{program.name}</span>
                                {(program.transferBonusPercent ?? 0) > 0 || program.clubActive || program.householdId ? (
                                    <span className="carteira-mini__perks">
                                        {program.householdId ? <em>Casa</em> : null}
                                        {(program.transferBonusPercent ?? 0) > 0 ? (
                                            <em>+{program.transferBonusPercent}%</em>
                                        ) : null}
                                        {program.clubActive ? <em>Clube</em> : null}
                                    </span>
                                ) : null}
                                {cmp != null || saldoBrl != null ? (
                                    <span className="carteira-mini__issuer">
                                        {cmp != null ? `CMP ${formatBRL(cmp)}` : null}
                                        {cmp != null && saldoBrl != null ? ' · ' : null}
                                        {saldoBrl != null ? formatBRL(saldoBrl) : null}
                                    </span>
                                ) : program.issuer ? (
                                    <span className="carteira-mini__issuer">{program.issuer}</span>
                                ) : null}
                                <span className="carteira-mini__bar" aria-hidden>
                                    <span style={{ width: `${freePct}%` }} />
                                </span>
                                <span
                                    className={`carteira-mini__need${
                                        reserved > 0 && free < reserved ? ' is-out' : reserved > 0 ? ' is-ok' : ''
                                    }`}
                                >
                                    {reserved > 0
                                        ? `Reservado ${formatPts(reserved)} · livre ${formatPts(free)}`
                                        : `Livre ${formatPts(free)}`}
                                </span>
                            </button>
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
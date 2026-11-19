import { unitLabel } from '@motor/milhas/catalog.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import { dateLabel, formatPts, type MilesProgram } from '../../pages/pontos/pontos-format';
import { saldoEmReais } from '../../domain/milhas-cmp';

type Props = {
    program: MilesProgram;
    onEdit: () => void;
};

function CapBar({ free, balance }: { free: number; balance: number }) {
    const pct = balance > 0 ? Math.min(100, Math.round((free / balance) * 100)) : 0;
    const over = free < balance * 0.15 && balance > 0;
    return (
        <div className="viagens-cap-bar milhas-spotlight__cap" role="progressbar" aria-valuenow={pct} aria-label="Saldo livre">
            <div
                className={`viagens-cap-bar__fill${over ? ' viagens-cap-bar__fill--over' : ''}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export function MilhasSpotlight({ program, onEdit }: Props) {
    const balance = Math.max(0, program.balance ?? 0);
    const free = Math.max(0, program.available ?? balance);
    const reserved = Math.max(0, program.committed ?? 0);
    const saldoBrl = saldoEmReais(program);
    const cmp = Number(program.milheiro) > 0 ? Number(program.milheiro) : null;

    const metaParts: string[] = [];
    if (program.holderUserName) metaParts.push(program.holderUserName);
    if (program.issuer) metaParts.push(program.issuer);
    if (program.expiresOn) metaParts.push(`val. ${dateLabel(program.expiresOn)}`);

    return (
        <section className={`milhas-spotlight pontos-wallet--${program.brand}`} aria-label={`Carteira ${program.name}`}>
            <div className="milhas-spotlight__glow" aria-hidden />
            <div className="milhas-spotlight__main">
                <div className="milhas-spotlight__identity">
                    <span className="milhas-spotlight__badge" aria-hidden>
                        <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={20} />
                    </span>
                    <span className="milhas-spotlight__unit">{unitLabel(program.unit || 'pontos', 2)}</span>
                    <h2>{program.name}</h2>
                    <div className="milhas-spotlight__meta">
                        {program.householdId ? (
                            <span className="milhas-spotlight__chip">
                                <MaterialIcon name="home" variant="app" opticalSize={14} />
                                Casa
                            </span>
                        ) : null}
                        {metaParts.length ? <span>{metaParts.join(' · ')}</span> : null}
                    </div>
                </div>
                <div className="milhas-spotlight__balance">
                    <strong>{formatPts(balance)}</strong>
                    {saldoBrl != null ? <span className="milhas-spotlight__brl">≈ {formatBRL(saldoBrl)}</span> : null}
                    <CapBar free={free} balance={balance} />
                    <span className="milhas-spotlight__cap-label">
                        {free === balance ? 'Tudo livre' : `${formatPts(free)} livres de ${formatPts(balance)}`}
                    </span>
                </div>
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost milhas-spotlight__edit"
                    onClick={onEdit}
                >
                    <MaterialIcon name="edit" variant="app" opticalSize={18} />
                    Editar
                </button>
            </div>
            <div className="milhas-spotlight__stats pontos-selected">
                <div>
                    <span>Livre</span>
                    <strong>{formatPts(free)}</strong>
                </div>
                <div>
                    <span>Reservado</span>
                    <strong>{formatPts(reserved)}</strong>
                </div>
                <div>
                    <span>CMP</span>
                    <strong>{cmp != null ? formatBRL(cmp) : '—'}</strong>
                </div>
                <div>
                    <span>Investido</span>
                    <strong>{formatBRL(Number(program.invested) || 0)}</strong>
                </div>
            </div>
            {program.notes ? <p className="milhas-spotlight__notes">{program.notes}</p> : null}
        </section>
    );
}
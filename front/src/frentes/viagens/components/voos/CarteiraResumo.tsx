import { unitLabel } from '@motor/milhas/catalog.js';
import { formatPts, type MilesProgram } from '../../pages/pontos/pontos-format';

export type WalletNeed = {
    program: MilesProgram;
    needed: number;
    gap: number;
};

type Props = {
    programs: MilesProgram[];
    needs: WalletNeed[];
    onOpen: (id: string) => void;
};

export function CarteiraResumo({ programs, needs, onOpen }: Props) {
    const needById = new Map(needs.map((n) => [n.program.id, n]));
    const cards = programs.length > 0 ? programs : [];

    return (
        <div className="carteira-resumo">
            {cards.length === 0 ? (
                <p className="voos-resumo__hint">
                    Nenhuma carteira ainda. Crie a primeira para acompanhar pontos, Avios e milhas.
                </p>
            ) : null}
            <div className="carteira-resumo__grid">
                {cards.map((program, index) => {
                    const need = needById.get(program.id);
                    const have = program.available ?? program.balance;
                    const needed = need?.needed ?? 0;
                    const gap = need?.gap ?? 0;
                    const pct = needed > 0 ? Math.min(100, Math.round((have / needed) * 100)) : have > 0 ? 100 : 0;
                    return (
                        <button
                            key={program.id}
                            type="button"
                            className={`carteira-mini pontos-wallet--${program.brand} pontos-wallet--unit-${program.unit || 'pontos'}`}
                            style={{ ['--shine-delay' as string]: `${index * 0.55}s` }}
                            onClick={() => onOpen(program.id)}
                            aria-label={`Abrir ${program.name}`}
                        >
                            <span className="carteira-mini__unit">{unitLabel(program.unit || 'pontos', 2)}</span>
                            <strong className="carteira-mini__saldo">{formatPts(program.balance)}</strong>
                            <span className="carteira-mini__name">{program.name}</span>
                            {(program.transferBonusPercent ?? 0) > 0 || program.clubActive ? (
                                <span className="carteira-mini__perks">
                                    {(program.transferBonusPercent ?? 0) > 0 ? (
                                        <em>+{program.transferBonusPercent}%</em>
                                    ) : null}
                                    {program.clubActive ? <em>Clube</em> : null}
                                </span>
                            ) : null}
                            {program.issuer ? <span className="carteira-mini__issuer">{program.issuer}</span> : null}
                            <span
                                className={`carteira-mini__bar${gap > 0 ? ' is-out' : needed > 0 ? ' is-ok' : ''}`}
                                aria-hidden
                            >
                                <span style={{ width: `${pct}%` }} />
                            </span>
                            <span className="carteira-mini__open">Abrir</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

import { spent } from '@motor/viagens/trips-engine.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import type { TripDraft } from '../ViagemFicha';

type Props = {
    draft: TripDraft;
    terrestreTotal: number;
    count: number;
};

export function TerrestreResumo({ draft, terrestreTotal, count }: Props) {
    const tripRef = { payload: draft.payload, budgetCaps: draft.budgetCaps };
    const cap = Math.max(0, Number(draft.budgetCaps?.transporte ?? 0) || 0);
    const categoryUsed = spent(tripRef, { category: 'transporte' });
    const remaining = cap > 0 ? Math.max(0, cap - categoryUsed) : null;
    const pct = cap > 0 ? Math.min(1.08, categoryUsed / cap) : 0;
    const over = cap > 0 && categoryUsed > cap;

    return (
        <section className="terrestre-resumo" aria-label="Orçamento transportes">
            <article className="terrestre-resumo__orcamento">
                <header className="terrestre-resumo__block-head">
                    <h2>Orçamento · Transportes</h2>
                    <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={18} />
                </header>
                <div className="orc-kpis terrestre-resumo__kpis">
                    <Kpi
                        label="Orçado"
                        value={cap > 0 ? formatBRL(cap) : '—'}
                        tone="ouro"
                        icon="savings"
                        hint={cap > 0 ? undefined : 'Defina no orçamento da viagem'}
                    />
                    <Kpi label="Gasto" value={formatBRL(categoryUsed)} tone="turquesa" icon="payments" />
                    <Kpi
                        label="Restante"
                        value={remaining != null ? formatBRL(remaining) : '—'}
                        tone={over ? 'coral' : 'ouro'}
                        icon="trending_flat"
                    />
                    <Kpi label="Nesta aba" value={formatBRL(terrestreTotal)} icon="directions_bus" />
                </div>
                {cap > 0 ? (
                    <div
                        className="viagens-cap-bar terrestre-resumo__bar"
                        role="progressbar"
                        aria-valuenow={Math.round(pct * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Uso do orçamento de transportes"
                    >
                        <div
                            className={`viagens-cap-bar__fill${over ? ' viagens-cap-bar__fill--over' : ''}`}
                            style={{ width: `${Math.min(100, pct * 100)}%` }}
                        />
                    </div>
                ) : (
                    <p className="terrestre-resumo__hint">
                        Sem teto na categoria Transportes — só o total registrado ({count}{' '}
                        {count === 1 ? 'item' : 'itens'}).
                    </p>
                )}
                {cap > 0 && over ? (
                    <p className="terrestre-resumo__hint">Acima do orçado em {formatBRL(categoryUsed - cap)}.</p>
                ) : null}
            </article>
        </section>
    );
}

function Kpi({
    label,
    value,
    tone,
    icon,
    hint
}: {
    label: string;
    value: string;
    tone?: 'turquesa' | 'ouro' | 'coral';
    icon: string;
    hint?: string;
}) {
    return (
        <div className={`orc-kpi${tone ? ` orc-kpi--${tone}` : ''} terrestre-kpi`} title={hint}>
            <span className="orc-kpi__row">
                <span className="orc-kpi__label">{label}</span>
                <span className="terrestre-kpi__icon" aria-hidden>
                    <MaterialIcon name={icon} variant="app" opticalSize={14} />
                </span>
            </span>
            <strong className="orc-kpi__value">{value}</strong>
        </div>
    );
}
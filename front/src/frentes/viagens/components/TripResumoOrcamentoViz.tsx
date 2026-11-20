import { useMemo } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatBRL } from '../utils/map-utils';
import type { buildOrcamentoSnapshot } from './orcamento/orcamento-model';

type Snap = ReturnType<typeof buildOrcamentoSnapshot>;

type Props = {
    snap: Snap;
};

type OrcCell = {
    key: 'meta' | 'cofrinho' | 'falta' | 'gastos';
    label: string;
    icon: string;
    value: number;
    tone: 'ouro' | 'turquesa' | 'oceano' | 'coral';
};

function pctOf(goal: number, value: number): number {
    if (goal <= 0 || value <= 0) return 0;
    return Math.min(100, Math.round((value / goal) * 100));
}

function moneyCompact(value: number): string {
    return value > 0 ? formatBRL(value) : '—';
}

export function TripResumoOrcamentoViz({ snap }: Props) {
    const goal = snap.effectiveGoal;
    const cofrinho = snap.saved;
    const falta = snap.stillToSave;
    const gastos = snap.spentTotal;
    const overBudget = goal > 0 && gastos > goal;

    const cells: OrcCell[] = useMemo(
        () => [
            { key: 'meta', label: 'Meta', icon: 'flag', value: goal, tone: 'ouro' },
            { key: 'cofrinho', label: 'No cofrinho', icon: 'savings', value: cofrinho, tone: 'turquesa' },
            { key: 'falta', label: 'Falta', icon: 'hourglass_top', value: falta, tone: 'oceano' },
            { key: 'gastos', label: 'Gastos', icon: 'shopping_bag', value: gastos, tone: overBudget ? 'coral' : 'oceano' }
        ],
        [goal, cofrinho, falta, gastos, overBudget]
    );

    return (
        <section
            className="viagens-resumo-orc"
            aria-label={
                goal > 0
                    ? `Orçamento: meta ${formatBRL(goal)}, cofrinho ${formatBRL(cofrinho)}, falta ${formatBRL(falta)}, gastos ${formatBRL(gastos)}`
                    : 'Orçamento da viagem'
            }
        >
            <div className="viagens-resumo-orc__grid" role="list">
                {cells.map((cell) => {
                    const barPct = cell.key === 'meta' ? (goal > 0 ? 100 : 0) : pctOf(goal, cell.value);
                    const pct = cell.key === 'meta' ? null : goal > 0 ? pctOf(goal, cell.value) : null;
                    return (
                        <article
                            key={cell.key}
                            className={`viagens-resumo-orc__cell viagens-resumo-orc__cell--${cell.tone}`}
                            role="listitem"
                        >
                            <header className="viagens-resumo-orc__cell-head">
                                <MaterialIcon name={cell.icon} variant="app" opticalSize={16} />
                                <span>{cell.label}</span>
                            </header>
                            <div className="viagens-resumo-orc__cell-mid">
                                <div className="viagens-resumo-orc__col-bar" aria-hidden>
                                    <span
                                        className={`viagens-resumo-orc__col-fill viagens-resumo-orc__col-fill--${cell.tone}`}
                                        style={{ height: `${barPct}%` }}
                                    />
                                </div>
                                <div className="viagens-resumo-orc__cell-copy">
                                    <strong title={moneyCompact(cell.value)}>{moneyCompact(cell.value)}</strong>
                                    <span
                                        className={`viagens-resumo-orc__pct${pct === null || pct <= 0 ? ' is-empty' : ''}`}
                                        aria-hidden={pct === null || pct <= 0}
                                    >
                                        {pct !== null && pct > 0 ? `${pct}%` : '\u00a0'}
                                    </span>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
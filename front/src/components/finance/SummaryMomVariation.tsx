import { momPctClass, type MomVariationState } from '../../frentes/dashboard/domain/momVariation';

const VS_PREV = 'vs mês anterior';
const TITLE = 'Variação em relação ao mês anterior';

type Props = {
    state: MomVariationState;
};

export function SummaryMomVariation({ state }: Props) {
    if (state.kind === 'hidden') return null;

    if (state.kind === 'need_single_month') {
        return (
            <span className="dashboard-card-scope">
                <span className="card-metric-hint" title="Escolha um único mês no filtro para comparar com o mês anterior.">
                    —
                </span>
            </span>
        );
    }
    if (state.kind === 'no_previous_base') {
        return (
            <span className="dashboard-card-scope">
                <span className="card-metric-hint" title="Sem valores no mês anterior para comparar.">
                    Sem base no mês anterior
                </span>
            </span>
        );
    }
    if (state.kind === 'no_values') {
        return (
            <span className="dashboard-card-scope">
                <span className="card-metric-hint" title="Não há valores neste mês nem no anterior para comparar.">
                    —
                </span>
            </span>
        );
    }

    const diff = state.diffPct;
    const icon = diff > 0 ? '↑' : '↓';
    const cls = momPctClass(diff, state.invertExpenseSemantics);

    return (
        <span className="dashboard-card-scope">
            <span className={`summary-mom-pct ${cls}`}>
                {icon} {Math.abs(diff).toFixed(1)}%
            </span>{' '}
            <span className="card-metric-hint" style={{ display: 'inline' }} title={TITLE}>
                {VS_PREV}
            </span>
        </span>
    );
}
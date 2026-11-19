import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import { formatBRL } from '../../utils/map-utils';
import { formatPts } from '../../pages/pontos/pontos-format';

export type MilhasKpi = {
    balance: number;
    reserved: number;
    free: number;
    milheiroAvg: number | null;
    saldoBrl: number | null;
    count: number;
};

export function MilhasSummaryCards({ kpi }: { kpi: MilhasKpi }) {
    return (
        <MovementSummaryCardsGrid group="milhas" ariaLabel="Resumo das carteiras">
            <MovementSummaryCard
                cardId="milhas-summary-balance"
                tone="savings"
                icon="account_balance_wallet"
                title="Saldo registrado"
                value={formatPts(kpi.balance)}
                iconTooltip={false}
                footer={
                    <span className="card-metric-hint">
                        {kpi.saldoBrl != null
                            ? `≈ ${formatBRL(kpi.saldoBrl)} em reais`
                            : `${kpi.count} carteira${kpi.count === 1 ? '' : 's'}`}
                    </span>
                }
            />
            <MovementSummaryCard
                cardId="milhas-summary-reserved"
                tone="savings"
                icon="pending"
                title="Reservado"
                value={formatPts(kpi.reserved)}
                iconTooltip={false}
                footer={<span className="card-metric-hint">em simulações</span>}
            />
            <MovementSummaryCard
                cardId="milhas-summary-free"
                tone="savings"
                icon="verified"
                title="Livre"
                value={formatPts(kpi.free)}
                iconTooltip={false}
                footer={<span className="card-metric-hint">disponível</span>}
            />
            <MovementSummaryCard
                cardId="milhas-summary-milheiro"
                tone="savings"
                icon="loyalty"
                title="Milheiro médio"
                value={kpi.milheiroAvg != null ? formatBRL(kpi.milheiroAvg) : '—'}
                iconTooltip={false}
                footer={<span className="card-metric-hint">ponderado</span>}
            />
        </MovementSummaryCardsGrid>
    );
}
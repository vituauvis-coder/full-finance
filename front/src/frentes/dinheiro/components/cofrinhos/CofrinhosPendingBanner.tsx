import { formatBRL } from '../../../../lib/format';
import { COFRINHO_POOL_SUBCATEGORY, EXPENSE_COFRINHO_CATEGORY } from '../../domain/cofrinhoConstants';
import { formatYearMonthLabel } from '../../domain/cofrinhoPeriod';

type Props = {
    pending: number;
    yearMonth: string;
    currency: string;
    onDistribute: () => void;
};

export function CofrinhosPendingBanner({ pending, yearMonth, currency, onDistribute }: Props) {
    if (pending <= 0) return null;

    return (
        <div
            id="cofrinhos-pending-banner"
            className="cofrinhos-page__pending dashboard-pending-cash-outs"
            aria-live="polite"
        >
            <h3 className="dashboard-pending-title">
                <i className="fas fa-piggy-bank" aria-hidden="true"></i> Aguardando alocação
            </h3>
            <p className="dashboard-pending-hint">
                Saídas em «{EXPENSE_COFRINHO_CATEGORY}» na subcategoria <strong>{COFRINHO_POOL_SUBCATEGORY}</strong> em{' '}
                {formatYearMonthLabel(yearMonth)} — distribua nas caixinhas.
            </p>
            <ul className="dashboard-pending-list">
                <li className="dashboard-pending-item">
                    <div className="dashboard-pending-item__text">
                        <span className="dashboard-pending-item__title">Saldo do pool</span>
                        <span className="dashboard-pending-item__detail">Valor ainda não distribuído</span>
                    </div>
                    <span className="dashboard-pending-item__amount">{formatBRL(pending, currency)}</span>
                    <button
                        type="button"
                        className="btn-primary btn-sm dashboard-pending-confirm"
                        id="cofrinhos-distribute-btn"
                        onClick={onDistribute}
                    >
                        Distribuir aporte
                    </button>
                </li>
            </ul>
        </div>
    );
}
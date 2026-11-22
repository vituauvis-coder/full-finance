import { formatBRL } from '../../../../lib/format';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { COFRINHO_POOL_SUBCATEGORY, EXPENSE_COFRINHO_CATEGORY } from '../../domain/cofrinhoConstants';
import type { CofrinhoPoolPendingMonth } from '../../domain/cofrinhoPending';

type Props = {
    items: CofrinhoPoolPendingMonth[];
    currency: string;
    onDistribute: (poolYearMonth: string) => void;
};

export function CofrinhosPendingBanner({ items, currency, onDistribute }: Props) {
    if (!items.length) return null;

    const total = items.reduce((s, i) => s + i.amount, 0);

    return (
        <div
            id="cofrinhos-pending-banner"
            className="cofrinhos-pending-strip dashboard-pending-cash-outs dashboard-pending-cash-outs--modern"
            aria-live="polite"
        >
            <header className="dashboard-pending-cash-outs__head">
                <div className="dashboard-pending-cash-outs__title-row">
                    <span className="dashboard-pending-cash-outs__icon-wrap" aria-hidden="true">
                        <MaterialIcon name="hourglass_top" variant="app" opticalSize={20} />
                    </span>
                    <h3 className="dashboard-pending-cash-outs__title">Aguardando alocação</h3>
                    <span
                        className="dashboard-pending-cash-outs__count"
                        aria-label={`${items.length} mês(es) com pool`}
                    >
                        {items.length}
                    </span>
                </div>
                <p className="dashboard-pending-cash-outs__hint">
                    Saídas em «{EXPENSE_COFRINHO_CATEGORY}» · subcategoria <strong>{COFRINHO_POOL_SUBCATEGORY}</strong>{' '}
                    — distribua nas caixinhas.
                </p>
            </header>
            <ul className="dashboard-pending-cash-outs__list">
                {items.map((item) => (
                    <li key={item.yearMonth} className="dashboard-pending-cash-outs__item">
                        <div className="dashboard-pending-cash-outs__main">
                            <span className="dashboard-pending-cash-outs__item-title">{item.label}</span>
                            <span className="dashboard-pending-cash-outs__sep" aria-hidden="true">
                                ·
                            </span>
                            <span className="dashboard-pending-cash-outs__item-detail">Pool do mês</span>
                        </div>
                        <div className="dashboard-pending-cash-outs__actions">
                            <span className="dashboard-pending-cash-outs__amount">
                                {formatBRL(item.amount, currency)}
                            </span>
                            <button
                                type="button"
                                className="dashboard-pending-cash-outs__confirm"
                                onClick={() => onDistribute(item.yearMonth)}
                            >
                                Distribuir
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            <footer className="cofrinhos-pending-strip__total">
                <span>Total pendente</span>
                <strong>{formatBRL(total, currency)}</strong>
            </footer>
        </div>
    );
}
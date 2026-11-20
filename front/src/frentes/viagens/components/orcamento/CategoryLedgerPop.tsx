import { useMemo } from 'react';
import { categoryLedgerItems } from '@motor/viagens/trip-category-ledger.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { ORCAMENTO_CATEGORIES } from './orcamento-model';
import { PayMethodChips } from './PayMethodChips';

type CategoryRow = {
    id: string;
    label: string;
    icon: string;
    used: number;
    cap: number;
    pay: { pixPaid: number; cardCommitted: number; cardInstallmentMonthly: number };
};

type TripRef = { payload: { destinations?: TripDestination[]; expenses?: unknown[]; stays?: unknown[]; legs?: unknown[] }; budgetCaps?: Record<string, number> };

type Props = {
    row: CategoryRow;
    tripRef: TripRef;
    destinations: TripDestination[];
    onClose: () => void;
    onAddExpense: (categoryId: string) => void;
};

function expenseDateShort(spentOn?: string): string {
    if (!spentOn?.trim()) return '—';
    const d = new Date(`${spentOn.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return spentOn;
    return d
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
        .replace(/\./g, '');
}

export function CategoryLedgerPop({ row, tripRef, destinations, onClose, onAddExpense }: Props) {
    const isBuiltin = ORCAMENTO_CATEGORIES.some((c) => c.id === row.id);
    const items = useMemo(
        () =>
            categoryLedgerItems(tripRef, isBuiltin ? { category: row.id } : { customCategoryId: row.id }),
        [tripRef, row.id, isBuiltin]
    );

    const destName = (id?: string | null) => destinations.find((d) => d.id === id)?.name ?? '';
    const falta = row.cap > 0 ? Math.max(0, row.cap - row.used) : null;

    return (
        <div className="orc-pop-overlay" role="presentation" onClick={onClose}>
            <div
                className="orc-pop orc-pop--ledger"
                role="dialog"
                aria-labelledby="orc-ledger-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="orc-pop__head orc-ledger__head">
                    <span className="orc-ledger__icon" aria-hidden>
                        <MaterialIcon name={row.icon} variant="app" opticalSize={22} />
                    </span>
                    <div className="orc-ledger__titles">
                        <h2 id="orc-ledger-title">{row.label}</h2>
                        <p className="orc-ledger__sub">Lançamentos e gastos desta categoria</p>
                    </div>
                    <button type="button" className="orc-pop__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={18} />
                    </button>
                </header>

                <div className="orc-ledger__summary" aria-label="Resumo da categoria">
                    <div className="orc-ledger-stat">
                        <span>Comprometido</span>
                        <strong>{formatBRL(row.used)}</strong>
                    </div>
                    {row.cap > 0 ? (
                        <div className="orc-ledger-stat">
                            <span>Teto</span>
                            <strong>{formatBRL(row.cap)}</strong>
                        </div>
                    ) : null}
                    {falta != null ? (
                        <div className="orc-ledger-stat orc-ledger-stat--coral">
                            <span>Falta</span>
                            <strong>{formatBRL(falta)}</strong>
                        </div>
                    ) : null}
                    <PayMethodChips
                        pay={row.pay}
                        layout="grid"
                        className="orc-ledger__pay"
                        cardHint
                        aria-label="Pix e cartão nesta categoria"
                    />
                </div>

                {items.length === 0 ? (
                    <p className="orc-pop__empty">Nenhum gasto nesta categoria ainda. Adicione um lançamento ou preencha a ficha.</p>
                ) : (
                    <ul className="orc-ledger-list">
                        {items.map((item) => (
                            <li key={`${item.kind}-${item.id}`} className={`orc-ledger-row orc-ledger-row--${item.kind}`}>
                                <div className="orc-ledger-row__main">
                                    <span className="orc-ledger-row__title">{item.title}</span>
                                    <span className="orc-ledger-row__meta">
                                        <span className="orc-ledger-row__source">{item.source}</span>
                                        <span className="orc-ledger-row__date">{expenseDateShort(item.spentOn)}</span>
                                        {destName(item.destinationId) ? (
                                            <span className="orc-ledger-row__dest">{destName(item.destinationId)}</span>
                                        ) : null}
                                    </span>
                                </div>
                                <div className="orc-ledger-row__side">
                                    <strong>{formatBRL(item.amount)}</strong>
                                    {item.kind === 'expense' && item.paymentMethod ? (
                                        <span
                                            className={`orc-ledger-row__pay orc-ledger-row__pay--${item.paymentMethod}`}
                                        >
                                            {item.paymentMethod === 'credit_card'
                                                ? item.installments && item.installments > 1
                                                    ? `Cartão ${item.installments}x`
                                                    : 'Cartão'
                                                : 'Pix'}
                                        </span>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <footer className="orc-pop__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Fechar
                    </button>
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--coral"
                        onClick={() => {
                            onAddExpense(row.id);
                            onClose();
                        }}
                    >
                        + Lançamento
                    </button>
                </footer>
            </div>
        </div>
    );
}
import { useMemo, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { WalletAccountCards } from '../wallet/WalletAccountCards';
import {
    isBankAccount,
    isCardAccountType,
    isCreditCardType,
    sortedBankAccounts,
    sumCardSpendInMonth
} from '../../../lib/accounts';
import type { Account } from '../../../lib/types/finance';
import { WalletAccountFormModal } from '../wallet/WalletAccountFormModal';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

export function CarteiraPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const [accountModal, setAccountModal] = useState<
        null | { editing: Account | null; linkedBankId?: string; kind?: 'bank' | 'credit' }
    >(null);
    const currency = data?.userProfile?.currency ?? 'BRL';
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());

    const banks = useMemo(() => (data ? sortedBankAccounts(data.userAccounts) : []), [data]);

    const cardsByBank = useMemo(() => {
        if (!data) return new Map<string, { credit: Account[]; debit: Account[] }>();
        const map = new Map<string, { credit: Account[]; debit: Account[] }>();
        for (const a of data.userAccounts) {
            if (!isCardAccountType(a.type)) continue;
            const bankId = String((a as Account & { linkedAccountId?: string }).linkedAccountId ?? '');
            if (!bankId) continue;
            if (!map.has(bankId)) map.set(bankId, { credit: [], debit: [] });
            const slot = isCreditCardType(a.type) ? 'credit' : 'debit';
            map.get(bankId)![slot].push(a);
        }
        return map;
    }, [data]);

    const creditCards = useMemo(
        () => (data?.userAccounts ?? []).filter((a) => isCreditCardType(a.type)),
        [data]
    );

    const monthInvoices = useMemo(() => {
        if (!data) return 0;
        let t = 0;
        for (const c of creditCards) t += sumCardSpendInMonth(c.id, data.userExpenses, year, month);
        return t;
    }, [data, creditCards, year, month]);

    const creditSummary = useMemo(() => {
        let limitTotal = 0;
        for (const c of creditCards) limitTotal += Number(c.limit) || 0;
        const available = Math.max(0, limitTotal - monthInvoices);
        return { limitTotal, available };
    }, [creditCards, monthInvoices]);

    if (loading) {
        return (
            <section className="page active wallet-page">
                <ScreenLoader label="Carregando carteira" />
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="page active wallet-page">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    const cashTotal = data.userAccounts.filter(isBankAccount).reduce((s, a) => s + (Number(a.balance) || 0), 0);

    return (
        <section id="wallet-page" className="page active wallet-page" aria-label="Carteira">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setAccountModal({ editing: null, kind: 'bank' })}
                >
                    Nova conta
                </button>
            </div>
            <div className="wallet-wallet-month" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <label>
                    Mês
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>
                                {String(i + 1).padStart(2, '0')}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Ano
                    <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} style={{ width: '5rem' }} />
                </label>
            </div>
            <div className="summary-cards movements-summary">
                <article className="summary-card summary-card--balance">
                    <h3 className="summary-card__title">Saldo em contas</h3>
                    <p className="summary-card__value">{formatBRL(cashTotal, currency)}</p>
                </article>
                <article className="summary-card summary-card--expense">
                    <h3 className="summary-card__title">Fatura estimada (mês)</h3>
                    <p className="summary-card__value">{formatBRL(monthInvoices, currency)}</p>
                </article>
                <article className="summary-card summary-card--projection">
                    <h3 className="summary-card__title">Limite total</h3>
                    <p className="summary-card__value">{formatBRL(creditSummary.limitTotal, currency)}</p>
                </article>
                <article className="summary-card summary-card--income">
                    <h3 className="summary-card__title">Poder de compra</h3>
                    <p className="summary-card__value">{formatBRL(creditSummary.available, currency)}</p>
                </article>
            </div>
            <div className="wallet-page__layout">
                <div className="wallet-page__main">
                    <h2 className="wallet-page__title">Instituições</h2>
                    <div id="wallet-institutions-list" className="wallet-institutions-list">
                        {banks.length === 0 ? (
                            <p className="card-metric-hint">Nenhuma conta bancária.</p>
                        ) : (
                            banks.map((bank) => {
                                const slots = cardsByBank.get(bank.id) ?? { credit: [], debit: [] };
                                return (
                                    <article key={bank.id} className="wallet-institution-card">
                                        <header className="wallet-institution-card__head">
                                            <h3>{bank.name}</h3>
                                            <span>{bank.balance != null ? formatBRL(Number(bank.balance), currency) : '—'}</span>
                                            <button
                                                type="button"
                                                className="btn-secondary btn-small"
                                                onClick={() => setAccountModal({ editing: bank })}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary btn-small"
                                                onClick={() => setAccountModal({ editing: null, linkedBankId: bank.id, kind: 'credit' })}
                                            >
                                                + Cartão
                                            </button>
                                        </header>
                                        <WalletAccountCards
                                            bankId={bank.id}
                                            creditAccounts={slots.credit.map((c) => ({
                                                ...c,
                                                balance: sumCardSpendInMonth(c.id, data.userExpenses, year, month)
                                            }))}
                                            debitAccounts={slots.debit}
                                        />
                                    </article>
                                );
                            })
                        )}
                    </div>
                </div>
                <aside className="wallet-page__aside" aria-label="Painel lateral da carteira">
                    <p className="card-metric-hint">
                        Valor no plástico de crédito = soma das saídas no mês civil (aproximação; ciclos de fatura no motor legado).
                    </p>
                </aside>
            </div>
            {accountModal ? (
                <WalletAccountFormModal
                    open
                    accounts={data.userAccounts}
                    editing={accountModal.editing}
                    defaultLinkedBankId={accountModal.linkedBankId}
                    defaultKind={accountModal.kind}
                    onClose={() => setAccountModal(null)}
                    onSaved={refresh}
                />
            ) : null}
        </section>
    );
}
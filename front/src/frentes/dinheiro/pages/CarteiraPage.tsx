import { useCallback, useMemo, useState } from 'react';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { WalletPageSkeleton } from '../../../components/skeleton/WalletPageSkeleton';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { monthIndexFromPeriod } from '../../../lib/period';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';
import type { Account } from '../../../lib/types/finance';
import { WalletAccountFormModal } from '../wallet/WalletAccountFormModal';
import { WalletInstitutionRow } from '../components/wallet/WalletInstitutionRow';
import { WalletAsidePanel } from '../components/wallet/WalletAsidePanel';
import { walletInstitutionRows } from '../domain/walletInstitutions';
import {
    computeWalletSummaryStats,
    creditCardDueAmount,
    walletActivityForMonth,
    walletDueList
} from '../domain/walletSummaryStats';
import { isCreditCardType, sumCardSpendInMonth } from '../../../lib/accounts';
import { deleteAccount } from '../api/wallet';
import { useConfirm } from '../../../components/ui/confirm';
import { useWalletHeaderRegistration } from '../context/WalletHeaderSlotContext';
import { useWalletInstitutionListClicks } from '../hooks/useWalletInstitutionListClicks';

export function CarteiraPage() {
    const { confirm } = useConfirm();
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading);
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const monthIndex = monthIndexFromPeriod(period);

    const [accountModal, setAccountModal] = useState<
        null | { editing: Account | null; linkedBankId?: string; kind?: 'bank' | 'credit' | 'debit' | 'food' | 'meal' }
    >(null);

    const openAccountModal = useCallback(
        (opts: {
            editing: Account | null;
            linkedBankId?: string;
            kind?: 'bank' | 'credit' | 'debit' | 'food' | 'meal';
        }) => {
            setAccountModal(opts);
        },
        []
    );

    useWalletHeaderRegistration(() => openAccountModal({ editing: null, kind: 'bank' }));
    useWalletInstitutionListClicks('wallet-institutions-list', openAccountModal);

    const currency = data?.userProfile?.currency ?? 'BRL';

    const rows = useMemo(
        () => (data ? walletInstitutionRows(data, year, monthIndex) : []),
        [data, year, monthIndex]
    );

    const summary = useMemo(
        () => (data ? computeWalletSummaryStats(data, year, monthIndex) : null),
        [data, year, monthIndex]
    );

    const creditCards = useMemo(
        () => (data?.userAccounts ?? []).filter((a) => isCreditCardType(a.type)),
        [data]
    );

    const dueRows = useMemo(() => {
        if (!data) return [];
        return walletDueList(creditCards, data, year, monthIndex);
    }, [data, creditCards, year, monthIndex]);

    const activity = useMemo(
        () => (data ? walletActivityForMonth(data, year, monthIndex) : []),
        [data, year, monthIndex]
    );

    const plasticAmountForCredit = useCallback(
        (cardId: string) => {
            if (!data) return 0;
            const card = creditCards.find((c) => c.id === cardId);
            if (!card) return 0;
            return creditCardDueAmount(card, data, year, monthIndex);
        },
        [data, creditCards, year, monthIndex]
    );

    const plasticAmountForBenefit = useCallback(
        (cardId: string) => {
            if (!data) return 0;
            return sumCardSpendInMonth(cardId, data.userExpenses, year, monthIndex);
        },
        [data, year, monthIndex]
    );

    const onDeleteBank = useCallback(
        async (bank: Account) => {
            const ok = await confirm({
                title: 'Excluir conta',
                message: `Excluir "${bank.name}"? Cartões vinculados podem ficar órfãos.`,
                confirmLabel: 'Excluir',
                tone: 'danger'
            });
            if (!ok) return;
            await deleteAccount(bank.id);
            await refresh();
        },
        [confirm, refresh]
    );

    if (showSkeleton) {
        return <WalletPageSkeleton />;
    }

    if (error || !data) {
        return (
            <section id="wallet-page" className="page active wallet-page wallet-page--modern">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    const limitHint =
        summary && summary.creditCardCount === 0
            ? 'Nenhum cartão de crédito cadastrado'
            : summary
              ? `${summary.creditCardCount} cartão(ões) · limite somado`
              : '';

    return (
        <section id="wallet-page" className="page active wallet-page wallet-page--modern" aria-label="Carteira">
            <CivilPeriodToolbar
                accent="wallet"
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                inMovementsToolbar
            />

            <MovementSummaryCardsGrid group="wallet" ariaLabel="Resumo da carteira">
                <MovementSummaryCard
                    cardId="wallet-summary-total-limit"
                    titleId="wallet-summary-limit-title"
                    tone="balance"
                    icon="fa-layer-group"
                    iconClassName="wallet-summary-kpi-icon--limit"
                    title="Limite total (crédito)"
                    value={formatBRL(summary?.limitTotal ?? 0, currency)}
                    hint={limitHint}
                    valueId="wallet-summary-total-limit"
                />
                <MovementSummaryCard
                    cardId="wallet-summary-invoices"
                    tone="expense"
                    icon="fa-credit-card"
                    title="Parcelas no crédito (mês)"
                    value={formatBRL(summary?.monthInvoices ?? 0, currency)}
                    valueId="wallet-summary-invoices"
                    description="Parcelas de crédito com vencimento no mês civil selecionado."
                    footer={
                        summary && summary.limitTotal > 0 ? (
                            <div id="wallet-summary-invoices-bar" className="wallet-kpi-progress" aria-hidden="true">
                                <span
                                    id="wallet-summary-invoices-bar-fill"
                                    className="wallet-kpi-progress__fill"
                                    style={{ width: `${summary.limitUsagePct}%` }}
                                />
                            </div>
                        ) : null
                    }
                />
                <MovementSummaryCard
                    cardId="wallet-summary-net"
                    tone="balance"
                    icon="fa-balance-scale"
                    title="Poder de compra real"
                    value={formatBRL(summary?.purchasingPower ?? 0, currency)}
                    valueId="wallet-summary-net"
                    valueClassName={
                        summary && summary.purchasingPower < 0 ? 'wallet-summary-value--negative' : undefined
                    }
                    description="Limite total menos faturas do mês civil."
                />
                <MovementSummaryCard
                    cardId="wallet-summary-cash"
                    tone="income"
                    icon="fa-university"
                    title="Saldo em contas"
                    value={formatBRL(summary?.cashTotal ?? 0, currency)}
                    description="Soma dos saldos das contas bancárias cadastradas."
                />
            </MovementSummaryCardsGrid>

            <div className="wallet-page__layout">
                <div className="wallet-page__main">
                    <div
                        id="wallet-institutions-list"
                        className="wallet-institutions-list"
                        aria-live="polite"
                        aria-label="Instituições"
                    >
                        {rows.length === 0 ? (
                            <p className="card-metric-hint">
                                Nenhuma conta bancária. Use <strong>Nova</strong> no topo.
                            </p>
                        ) : (
                            rows.map((row) => (
                                <WalletInstitutionRow
                                    key={
                                        row.kind === 'bank'
                                            ? `bank-${row.bank.id}`
                                            : `orphan-${row.card.id}-${row.kind}`
                                    }
                                    row={row}
                                    plasticAmountForCredit={plasticAmountForCredit}
                                    plasticAmountForBenefit={plasticAmountForBenefit}
                                    actions={{
                                        currency,
                                        onEditBank: (bank) => setAccountModal({ editing: bank }),
                                        onDeleteBank
                                    }}
                                />
                            ))
                        )}
                    </div>
                </div>
                <aside className="wallet-page__aside" aria-label="Painel lateral da carteira">
                    <WalletAsidePanel
                        monthIndex={monthIndex}
                        year={year}
                        currency={currency}
                        dueRows={dueRows}
                        activity={activity}
                    />
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
import { useCallback, useMemo } from 'react';
import { updateDebt } from '../api/debts';
import type { DebtColorKey } from '../domain/debtColors';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { DebtsPageSkeleton } from '../../../components/skeleton/DebtsPageSkeleton';
import { useFinanceShellVeil } from '../../../hooks/useFinanceShellVeil';
import { debtsSummaryFromData } from '../domain/debtSummaryStats';
import type { Debt, DebtUpdate } from '../domain/debtTypes';
import { useDebtsHeaderRegistration } from '../context/DebtsHeaderSlotContext';
import { useDebtsModals } from '../hooks/useDebtsModals';
import {
    DebtsBalanceChart,
    DebtsCardsGrid,
    DebtsPageModals,
    DebtsPageShell,
    DebtsSummaryPanel
} from '../components/debts';

export function DividasPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useFinanceShellVeil('debts');
    const modals = useDebtsModals();

    const currency = data?.userProfile?.currency ?? 'BRL';
    const debts = useMemo(() => (data?.userDebts ?? []) as Debt[], [data?.userDebts]);
    const updates = useMemo(() => (data?.userDebtUpdates ?? []) as DebtUpdate[], [data?.userDebtUpdates]);

    const summary = useMemo(() => debtsSummaryFromData(debts, updates), [debts, updates]);

    useDebtsHeaderRegistration(modals.openCreate);

    const onRefresh = useCallback(async () => {
        await refresh();
    }, [refresh]);

    const onColorChange = useCallback(
        async (debtId: string, colorKey: DebtColorKey) => {
            const debt = debts.find((d) => d.id === debtId);
            if (!debt || (debt.colorKey || 'wine') === colorKey) return;
            await updateDebt(debtId, { colorKey });
            await onRefresh();
        },
        [debts, onRefresh]
    );

    if (showSkeleton) {
        return (
            <DebtsPageShell>
                <DebtsPageSkeleton />
            </DebtsPageShell>
        );
    }

    if (error || !data) {
        return (
            <DebtsPageShell>
                <p role="alert">{error ?? 'Sem dados'}</p>
            </DebtsPageShell>
        );
    }

    return (
        <DebtsPageShell>
            <DebtsSummaryPanel currency={currency} summary={summary} />
            <DebtsBalanceChart debts={debts} updates={updates} currency={currency} />
            <DebtsCardsGrid
                debts={debts}
                updates={updates}
                currency={currency}
                onRegister={modals.openRegister}
                onSettings={modals.openSettings}
                onColorChange={onColorChange}
                onRequestCreate={modals.openCreate}
            />
            <DebtsPageModals
                debts={debts}
                updates={updates}
                createOpen={modals.createOpen}
                registerDebtId={modals.registerDebtId}
                settingsDebtId={modals.settingsDebtId}
                onCloseCreate={modals.closeCreate}
                onCloseRegister={modals.closeRegister}
                onCloseSettings={modals.closeSettings}
                onSaved={onRefresh}
            />
        </DebtsPageShell>
    );
}
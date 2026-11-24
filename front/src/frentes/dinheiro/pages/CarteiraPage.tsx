import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { WalletPageSkeleton } from '../../../components/skeleton/WalletPageSkeleton';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { CIVIL_YEAR_PERIOD, walletCatalogMonthIndex } from '../../../lib/period';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { useFinanceShellVeil } from '../../../hooks/useFinanceShellVeil';
import type { Account } from '../../../lib/types/finance';
import { WalletAccountFormModal } from '../wallet/WalletAccountFormModal';
import { WalletCardCatalog } from '../components/wallet/WalletCardCatalog';
import type { WalletAccountKind } from '../wallet/walletAccountKind';
import { useWalletHeaderRegistration } from '../context/WalletHeaderSlotContext';
import { useWalletInstitutionListClicks } from '../hooks/useWalletInstitutionListClicks';
import { useMovementListFilters } from '../context/MovementListFiltersContext';

export function CarteiraPage() {
    const navigate = useNavigate();
    const listFilters = useMovementListFilters();
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useFinanceShellVeil('wallet');
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const monthIndex = useMemo(() => walletCatalogMonthIndex(period, year), [period, year]);
    const onYearScopeSelect = useCallback(() => onPeriodChange(CIVIL_YEAR_PERIOD), [onPeriodChange]);

    const [accountModal, setAccountModal] = useState<
        null | { editing: Account | null; linkedBankId?: string; kind?: WalletAccountKind }
    >(null);

    const openAccountModal = useCallback(
        (opts: { editing: Account | null; linkedBankId?: string; kind?: WalletAccountKind }) => {
            setAccountModal(opts);
        },
        []
    );

    useWalletHeaderRegistration(() => openAccountModal({ editing: null, kind: 'bank' }));
    useWalletInstitutionListClicks('wallet-card-catalog', openAccountModal);

    const currency = data?.userProfile?.currency ?? 'BRL';

    const onPlasticOpen = useCallback(
        (cardId: string) => {
            listFilters?.setFilter('accountId', cardId);
            navigate('/dinheiro/saidas');
        },
        [listFilters, navigate]
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

    return (
        <section
            id="wallet-page"
            className="page active wallet-page wallet-page--modern wallet-page--compact"
            aria-label="Carteira"
        >
            <CivilPeriodToolbar
                accent="wallet"
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                inMovementsToolbar
                onYearScopeSelect={onYearScopeSelect}
            />

            <WalletCardCatalog
                data={data}
                year={year}
                monthIndex={monthIndex}
                currency={currency}
                onEdit={(acc) => setAccountModal({ editing: acc })}
                onPlasticOpen={onPlasticOpen}
            />

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
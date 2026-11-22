import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovementListFilters } from '../context/MovementListFiltersContext';

import type { WalletAccountKind } from '../wallet/walletAccountKind';

type OpenCardModal = (opts: {
    editing: null;
    linkedBankId?: string;
    kind?: WalletAccountKind;
}) => void;

/** Delegação de cliques na lista (plásticos, placeholders, atalhos). */
export function useWalletInstitutionListClicks(
    listId: string,
    openAccountModal: OpenCardModal
) {
    const navigate = useNavigate();
    const listFilters = useMovementListFilters();

    useEffect(() => {
        const root = document.getElementById(listId);
        if (!root) return;

        const onClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const linkFood = target.closest('[data-wallet-link-food]');
            if (linkFood) {
                e.preventDefault();
                const bid = linkFood.getAttribute('data-wallet-link-food');
                if (bid) openAccountModal({ editing: null, linkedBankId: bid, kind: 'food' });
                return;
            }

            const linkMeal = target.closest('[data-wallet-link-meal]');
            if (linkMeal) {
                e.preventDefault();
                const bid = linkMeal.getAttribute('data-wallet-link-meal');
                if (bid) openAccountModal({ editing: null, linkedBankId: bid, kind: 'meal' });
                return;
            }

            const linkCredit = target.closest('[data-wallet-link-credit]');
            if (linkCredit) {
                e.preventDefault();
                const bid = linkCredit.getAttribute('data-wallet-link-credit');
                if (bid) openAccountModal({ editing: null, linkedBankId: bid, kind: 'credit' });
                return;
            }

            const linkDebit = target.closest('[data-wallet-link-debit]');
            if (linkDebit) {
                e.preventDefault();
                const bid = linkDebit.getAttribute('data-wallet-link-debit');
                if (bid) openAccountModal({ editing: null, linkedBankId: bid, kind: 'debit' });
                return;
            }

            const plastic = target.closest('button.wallet-card-open[data-card-id]');
            if (plastic) {
                const cardId = plastic.getAttribute('data-card-id');
                if (cardId) {
                    listFilters?.setFilter('accountId', cardId);
                    navigate('/dinheiro/saidas');
                }
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const target = e.target as HTMLElement | null;
            const plastic = target?.closest('button.wallet-card-open[data-card-id]');
            if (!plastic) return;
            e.preventDefault();
            const cardId = plastic.getAttribute('data-card-id');
            if (cardId) {
                listFilters?.setFilter('accountId', cardId);
                navigate('/dinheiro/saidas');
            }
        };

        root.addEventListener('click', onClick);
        root.addEventListener('keydown', onKeyDown);
        return () => {
            root.removeEventListener('click', onClick);
            root.removeEventListener('keydown', onKeyDown);
        };
    }, [listId, navigate, listFilters, openAccountModal]);
}
import {
    buildPlasticInlineStyle,
    resolvePlasticColors
} from '@legacy/js/features/finance/account-plastic-appearance.js';
import { accountShortId } from '../../../lib/accountIdentity';
import type { Account } from '../../../lib/types/finance';

export type PlasticSlot = 'credit' | 'debit' | 'food' | 'meal';

export function buildPlasticMotorPayload(
    card: Account,
    slot: PlasticSlot,
    opts: {
        bankAccount?: Account | null;
        walletMode: 'bank' | 'benefit';
        themeClass: string;
        amountText?: string;
        dueText?: string;
        displayName?: string;
    }
) {
    const colors = resolvePlasticColors(opts.bankAccount ?? null, card);
    const useCustom = !!colors;
    const colorKind = slot === 'debit' || slot === 'meal' ? 'debit' : 'credit';
    const themeClass = useCustom ? '' : opts.themeClass;
    const inlineStyle = useCustom ? buildPlasticInlineStyle(colorKind, colors) : '';

    return {
        id: card.id,
        idTag: accountShortId(card.id),
        idFull: card.id,
        name: opts.displayName?.trim() || card.name,
        slot,
        walletMode: opts.walletMode,
        amountText: opts.amountText,
        dueText: opts.dueText,
        themeClass: themeClass || undefined,
        useCustom,
        inlineStyle: inlineStyle || undefined
    };
}
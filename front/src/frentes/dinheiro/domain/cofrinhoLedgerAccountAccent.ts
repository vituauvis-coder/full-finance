import {
    GENERIC_PLASTIC_DEFAULTS,
    resolvePlasticColors
} from '@legacy/js/features/finance/account-plastic-appearance.js';
import type { Account } from '../../../lib/types/finance';

/** Cor de destaque da conta para tags no extrato (plástico / marca). */
export function cofrinhoLedgerAccountAccent(account: Account | undefined): string {
    if (!account) return GENERIC_PLASTIC_DEFAULTS.color;
    const colors = resolvePlasticColors(account, account);
    if (!colors) return GENERIC_PLASTIC_DEFAULTS.color;
    return colors.credit ?? colors.color ?? GENERIC_PLASTIC_DEFAULTS.color;
}
import {
    buildStripInlineStyle,
    defaultColorsForThemeClass,
    resolvePlasticColors
} from '@legacy/js/features/finance/account-plastic-appearance.js';
import type { Account } from '../../../lib/types/finance';

/** Faixa lateral = cor do plástico/cartão (custom da conta ou tema do banco). */
export function institutionStripStyle(
    bank: Account | null,
    themeClass: string
): { background?: string } | undefined {
    const fromAccount = bank ? resolvePlasticColors(bank, null) : null;
    const colors =
        fromAccount ||
        (themeClass ? defaultColorsForThemeClass(themeClass) : null);
    if (!colors) return undefined;

    const css = buildStripInlineStyle(colors);
    if (!css) return undefined;
    const m = /^background:\s*(.+)$/.exec(css.trim());
    if (!m) return undefined;
    return { background: m[1].trim() };
}
/** Converte taxa de embarque (qualquer moeda) para BRL no custo do dia. */

import Decimal from 'decimal.js';

/** Fallback offline quando a cotação ao vivo não carrega (atualize periodicamente). */
export const DEFAULT_TAX_FX = {
    BRL: 1,
    EUR: 6.35,
    USD: 5.78,
    GBP: 7.63,
    ARS: 0.0055,
    CLP: 0.0062,
    MXN: 0.34,
    JPY: 0.038,
    CHF: 6.72,
    CAD: 4.15,
    AUD: 3.72,
    TRY: 0.17,
    CNY: 0.78,
    HKD: 0.74,
    KRW: 0.0039
};

function dec(n) {
    const d = new Decimal(n ?? 0);
    return d.isFinite() ? d : new Decimal(0);
}

/**
 * @param {string} currency
 * @param {number | null | undefined} fxRate valor salvo no voo/emissão
 * @param {Record<string, number> | null | undefined} [liveQuotes] cotação do dia (AwesomeAPI / API interna)
 */
export function effectiveTaxFxRate(currency, fxRate, liveQuotes = null) {
    const code = String(currency ?? 'BRL').toUpperCase();
    if (code === 'BRL') return 1;
    const n = Number(fxRate);
    if (Number.isFinite(n) && n > 0) return n;
    const live = liveQuotes?.[code];
    if (Number.isFinite(live) && live > 0) return live;
    return DEFAULT_TAX_FX[code] ?? 0;
}

/**
 * @param {{ amount?: number | string | null, currency?: string, fxRate?: number | null, iofPercent?: number | null, spreadPercent?: number | null }} input
 * @returns {number} valor em reais, 2 casas
 */
export function taxesToBrl(input = {}) {
    const amount = dec(input.amount ?? input.taxesAmount ?? input.taxes_amount);
    if (!amount.gt(0)) return 0;
    const currency = String(input.currency ?? input.taxesCurrency ?? input.taxes_currency ?? 'BRL').toUpperCase();
    if (currency === 'BRL') return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

    const fx = effectiveTaxFxRate(currency, input.fxRate ?? input.taxFxRate ?? input.tax_fx_rate);
    if (!(fx > 0)) return 0;

    const iof = dec(input.iofPercent ?? input.taxIofPercent ?? input.tax_iof_percent);
    const spread = dec(input.spreadPercent ?? input.taxSpreadPercent ?? input.tax_spread_percent);

    return amount
        .mul(fx)
        .mul(new Decimal(1).plus(iof.div(100)))
        .mul(new Decimal(1).plus(spread.div(100)))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
}
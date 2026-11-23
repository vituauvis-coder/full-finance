import { buildCofrinhoMonthlyYieldEvents } from '../dinheiro/cofrinho-monthly-yield.js';
import { tripCofrinhoTotalsFromFinance } from './trip-cofrinho-finance.js';

function roundMoney(n) {
    return Math.round(Number(n) * 100) / 100;
}

/**
 * KPIs do cofrinho da viagem (aportes do ledger + rendimento das reconciliações).
 *
 * @param {Array<{ ledgerKind?: string, amount?: number }>} financeLines
 * @param {Array<{ bucketId?: string, bucket_id?: string, referenceMonth?: string, reference_month?: string, principalAmount?: number, principal_amount?: number, balanceWithYield?: number, balance_with_yield?: number }>} monthlySnapshots
 */
export function buildTripCofrinhoMeta(financeLines = [], monthlySnapshots = []) {
    const { aportes, gastosCofrinho, remaining: principalRemaining } =
        tripCofrinhoTotalsFromFinance(financeLines);
    const yieldTotal = roundMoney(
        buildCofrinhoMonthlyYieldEvents(monthlySnapshots).reduce(
            (s, ev) => s + (Number(ev?.amount) || 0),
            0
        )
    );
    const remaining = roundMoney(Math.max(0, principalRemaining + yieldTotal));
    return {
        aportes: roundMoney(aportes),
        gastosCofrinho: roundMoney(gastosCofrinho),
        rendimento: yieldTotal,
        remaining
    };
}
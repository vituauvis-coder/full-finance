/**
 * Lista de pagamentos a confirmar no saldo (parcelas de cartão parcelado; modo manual do perfil para outros casos).
 */
import {
    getInstallmentDueDates,
    getLoanInstallmentDueDates,
    isLoanDueEligibleForAutoCashOut,
    isLoanExpense,
    isMonthlyFixedCashAccountExpense,
    shouldDeferCashOutForMonthlyFixedSeries,
    startOfDay
} from '../../core/credit-installments.js';
import {
    calendarDayKeyFromDate,
    getFinancePreferences,
    isPeriodConfirmedForDebit,
    monthKeyFromDate,
    parseCashOutConfirmedPeriods,
    shouldDeferCreditCardCashOut,
    shouldDeferLoanCashOut
} from '../../core/finance-preferences.js';
import { isCreditCardType, movementDateToJsDate } from '../../core/utils.js';

function parseCardDay(value) {
    if (value == null || value === '') return undefined;
    const n = typeof value === 'number' && Number.isFinite(value) ? value : parseInt(String(value).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 31) return undefined;
    return n;
}

/**
 * @returns {Array<{ expenseId: string, periodKey: string, title: string, detail: string, amount: number }>}
 */
export function buildPendingCashOutItems(userAccounts, userExpenses, userProfile, now = new Date()) {
    const prefs = getFinancePreferences(userProfile);
    const manualEnabled = !!prefs.manualCashOut?.enabled;

    const items = [];
    const byId = new Map((userAccounts || []).map((a) => [a.id, a]));
    const t0 = startOfDay(now).getTime();

    for (const e of userExpenses || []) {
        const acc = byId.get(e.accountId);
        if (e.isPaid === true) {
            const isRecSeries = e.recurrenceGroupId != null && String(e.recurrenceGroupId).trim() !== '';
            const stillNeedsCashConfirm =
                acc &&
                !isCreditCardType(acc.type) &&
                isMonthlyFixedCashAccountExpense(e, acc) &&
                shouldDeferCashOutForMonthlyFixedSeries(e, acc, userProfile) &&
                (manualEnabled || isRecSeries) &&
                !isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(e), movementDateToJsDate(e.date));
            if (!stillNeedsCashConfirm) continue;
        }
        const confirmed = parseCashOutConfirmedPeriods(e);

        if (acc && isCreditCardType(acc.type)) {
            const closeDay = acc.closeDay ?? acc.closingDay;
            const dueDay = acc.dueDay ?? acc.dueDate;
            const n = Math.max(1, parseInt(String(e.installmentCount ?? '1'), 10) || 1);
            const purchase = movementDateToJsDate(e.date);
            const amt = Number(e.amount) || 0;

            // Parcelado: lembretes no painel sem precisar ativar «modo manual» no perfil.
            if (n >= 2 && parseCardDay(dueDay) != null) {
                const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
                const per = amt / n;
                dueDates.forEach((d) => {
                    if (startOfDay(d).getTime() > t0) return;
                    if (isPeriodConfirmedForDebit(confirmed, d)) return;
                    const pk = calendarDayKeyFromDate(d);
                    items.push({
                        expenseId: e.id,
                        periodKey: pk,
                        title: `Cartão · ${e.description || 'Parcela'}`,
                        detail: `Parcela · venc. ${d.toLocaleDateString('pt-BR')}`,
                        amount: per
                    });
                });
                continue;
            }

            if (
                manualEnabled &&
                (shouldDeferCreditCardCashOut(prefs) || confirmed.size > 0)
            ) {
                if (parseCardDay(dueDay) == null) {
                    if (n >= 2) continue;
                    if (startOfDay(purchase).getTime() > t0) continue;
                    const pk = calendarDayKeyFromDate(purchase);
                    if (isPeriodConfirmedForDebit(confirmed, purchase)) continue;
                    items.push({
                        expenseId: e.id,
                        periodKey: pk,
                        title: `Cartão · ${e.description || 'Compra'}`,
                        detail: `À vista · vencimento implícito na data da compra`,
                        amount: amt
                    });
                    continue;
                }

                const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
                const per = amt / n;
                dueDates.forEach((d) => {
                    if (startOfDay(d).getTime() > t0) return;
                    if (isPeriodConfirmedForDebit(confirmed, d)) return;
                    const pk = calendarDayKeyFromDate(d);
                    items.push({
                        expenseId: e.id,
                        periodKey: pk,
                        title: `Cartão · ${e.description || 'Parcela'}`,
                        detail: `Parcela · venc. ${d.toLocaleDateString('pt-BR')}`,
                        amount: per
                    });
                });
                continue;
            }
        }

        if (manualEnabled && acc && !isCreditCardType(acc.type) && isLoanExpense(e) && shouldDeferLoanCashOut(prefs)) {
            const n = Math.max(1, parseInt(String(e.installmentCount ?? '1'), 10) || 1);
            if (n < 2) continue;
            const purchase = movementDateToJsDate(e.date);
            const amt = Number(e.amount) || 0;
            const dueDates = getLoanInstallmentDueDates(purchase, n);
            const per = amt / n;
            dueDates.forEach((d) => {
                if (startOfDay(d).getTime() > t0) return;
                if (isPeriodConfirmedForDebit(confirmed, d)) return;
                const pk = calendarDayKeyFromDate(d);
                items.push({
                    expenseId: e.id,
                    periodKey: pk,
                    title: `Empréstimo · ${e.description || 'Parcela'}`,
                    detail: `Parcela · venc. ${d.toLocaleDateString('pt-BR')}`,
                    amount: per
                });
            });
            continue;
        }

        if (
            acc &&
            !isCreditCardType(acc.type) &&
            isLoanExpense(e) &&
            !shouldDeferLoanCashOut(prefs)
        ) {
            const n = Math.max(1, parseInt(String(e.installmentCount ?? '1'), 10) || 1);
            if (n < 2) continue;
            const purchase = movementDateToJsDate(e.date);
            const amt = Number(e.amount) || 0;
            const dueDates = getLoanInstallmentDueDates(purchase, n);
            const per = amt / n;
            dueDates.forEach((d) => {
                if (startOfDay(d).getTime() > t0) return;
                if (isLoanDueEligibleForAutoCashOut(e, d)) return;
                if (isPeriodConfirmedForDebit(confirmed, d)) return;
                const pk = calendarDayKeyFromDate(d);
                items.push({
                    expenseId: e.id,
                    periodKey: pk,
                    title: `Empréstimo · ${e.description || 'Parcela'}`,
                    detail: `Parcela antes do cadastro no app · venc. ${d.toLocaleDateString('pt-BR')}`,
                    amount: per
                });
            });
            continue;
        }

        const isRecSeries = e.recurrenceGroupId != null && String(e.recurrenceGroupId).trim() !== '';
        if (
            acc &&
            !isCreditCardType(acc.type) &&
            shouldDeferCashOutForMonthlyFixedSeries(e, acc, userProfile) &&
            (manualEnabled || isRecSeries)
        ) {
            const d = movementDateToJsDate(e.date);
            if (startOfDay(d).getTime() > t0) continue;
            if (isPeriodConfirmedForDebit(confirmed, d)) continue;
            const pk = monthKeyFromDate(d);
            items.push({
                expenseId: e.id,
                periodKey: pk,
                title: `${isRecSeries ? 'Série mensal' : 'Conta fixa'} · ${e.description || e.category || 'Mensal'}`,
                detail: `${e.category || 'Saída'} · ${d.toLocaleDateString('pt-BR')}`,
                amount: Number(e.amount) || 0
            });
        }
    }

    return items;
}

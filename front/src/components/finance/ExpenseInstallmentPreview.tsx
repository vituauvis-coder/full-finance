import { useMemo } from 'react';
import type { Account } from '../../lib/types/finance';
import { isCreditCardType } from '../../lib/accounts';
import { formatBRL } from '../../lib/format';
import {
    getInstallmentDueDates,
    getLoanInstallmentDueDates
} from '@motor/dinheiro/credit-installments.js';
import {
    calendarDayKeyFromDate,
    monthKeyFromDate
} from '@motor/dinheiro/cash-out-periods.js';

type Props = {
    date: string;
    installmentCount: number;
    amount: number;
    account?: Account | null;
    loan: boolean;
    paidKeys: string[];
    onTogglePeriod: (periodKey: string) => void;
    currency?: string;
    now?: Date;
};

function formatMonthTag(d: Date) {
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export function resolveInstallmentDueDates(
    date: string,
    installmentCount: number,
    account: Account | null | undefined,
    loan: boolean
): Date[] {
    const n = Math.min(99, Math.max(1, installmentCount || 1));
    if (n < 2) return [];
    const purchase = new Date(`${date}T12:00:00`);
    if (Number.isNaN(purchase.getTime())) return [];

    if (loan && (!account || !isCreditCardType(account.type))) {
        return getLoanInstallmentDueDates(purchase, n) as Date[];
    }

    if (account && isCreditCardType(account.type)) {
        const closeDay = account.closeDay ?? account.closingDay;
        const dueDay = account.dueDay ?? account.dueDate;
        if (dueDay == null || dueDay === '') return [];
        return getInstallmentDueDates(purchase, n, closeDay, dueDay) as Date[];
    }

    return [];
}

/**
 * Preview de parcelas (anel + tags mensais clicáveis) — paridade com o legado,
 * visual alinhado à modal React.
 */
export function ExpenseInstallmentPreview({
    date,
    installmentCount,
    amount,
    account = null,
    loan,
    paidKeys,
    onTogglePeriod,
    currency = 'BRL',
    now: nowProp
}: Props) {
    const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
    const n = Math.min(99, Math.max(1, installmentCount || 1));
    const isCredit = !!(account && isCreditCardType(account.type));

    const dueDates = useMemo(
        () => resolveInstallmentDueDates(date, n, account, loan),
        [date, n, account, loan]
    );

    const paidSet = useMemo(() => new Set(paidKeys), [paidKeys]);
    const nowMk = monthKeyFromDate(now);

    const paidCount = dueDates.filter((d) => {
        const dk = calendarDayKeyFromDate(d);
        const mk = monthKeyFromDate(d);
        return paidSet.has(dk) || paidSet.has(mk);
    }).length;
    const remaining = Math.max(0, dueDates.length - paidCount);
    const total = dueDates.length;

    if (n < 2) return null;

    if (isCredit) {
        const closeDay = account?.closeDay ?? account?.closingDay;
        const dueDay = account?.dueDay ?? account?.dueDate;
        if (!closeDay || !dueDay) {
            return (
                <p className="ui-form-hint-block expense-inst-preview__hint">
                    Defina o fechamento e o vencimento do cartão no cadastro para ver o cronograma
                    das parcelas.
                </p>
            );
        }
    }

    if (dueDates.length < 2) return null;

    const per = total > 0 ? amount / Math.max(1, n) : amount;
    const r = 20;
    const circumference = 2 * Math.PI * r;
    const frac = total > 0 ? paidCount / total : 0;
    const dashOffset = circumference * (1 - frac);

    const title = loan && !isCredit ? 'Parcelas do empréstimo' : 'Parcelas restantes';
    const hint = loan && !isCredit
        ? 'Toque no mês para marcar a parcela como paga no caixa.'
        : 'Vencimentos estimados pelo ciclo do cartão. Toque no mês para marcar no caixa.';

    return (
        <div className="expense-inst-preview" role="status">
            <div className="expense-inst-preview__summary">
                <div className="expense-inst-preview__ring" aria-hidden="true">
                    <svg className="expense-inst-preview__ring-svg" viewBox="0 0 52 52" width="52" height="52">
                        <circle
                            className="expense-inst-preview__ring-track"
                            cx="26"
                            cy="26"
                            r={r}
                            fill="none"
                        />
                        <g transform="rotate(-90 26 26)">
                            <circle
                                className="expense-inst-preview__ring-progress"
                                cx="26"
                                cy="26"
                                r={r}
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                            />
                        </g>
                    </svg>
                    <span className="expense-inst-preview__ring-num">{remaining}</span>
                </div>
                <div className="expense-inst-preview__copy">
                    <span className="expense-inst-preview__title">{title}</span>
                    <span className="expense-inst-preview__line">
                        {remaining === 0 ? (
                            <>Todas as <strong>{total}</strong> parcelas confirmadas</>
                        ) : (
                            <>
                                <strong>{remaining}</strong> de <strong>{total}</strong> a pagar
                                {Number.isFinite(per) && per > 0 ? (
                                    <> · {formatBRL(per, currency)}</>
                                ) : null}
                            </>
                        )}
                    </span>
                    <span className="expense-inst-preview__hint">{hint}</span>
                </div>
            </div>
            <div className="expense-inst-preview__tags" role="group" aria-label="Parcelas no caixa">
                {dueDates.map((d) => {
                    const pk = calendarDayKeyFromDate(d);
                    const mk = monthKeyFromDate(d);
                    const isPaid = paidSet.has(pk) || paidSet.has(mk);
                    const unpaidDueOrPast = !isPaid && mk <= nowMk;
                    const lab = formatMonthTag(d);
                    const cls = [
                        'expense-inst-preview__tag',
                        isPaid ? 'expense-inst-preview__tag--paid' : 'expense-inst-preview__tag--pending',
                        unpaidDueOrPast ? 'expense-inst-preview__tag--due' : ''
                    ]
                        .filter(Boolean)
                        .join(' ');
                    return (
                        <button
                            key={pk}
                            type="button"
                            className={cls}
                            title={
                                isPaid
                                    ? `Desmarcar parcela de ${lab}`
                                    : `Marcar parcela de ${lab} como paga`
                            }
                            onClick={() => onTogglePeriod(pk)}
                        >
                            {lab}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

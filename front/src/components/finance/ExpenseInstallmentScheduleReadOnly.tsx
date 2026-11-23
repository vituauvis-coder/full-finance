import { useMemo } from 'react';
import type { Account, Movement } from '../../lib/types/finance';
import { formatBRL } from '../../lib/format';
import { isCreditCardType } from '../../lib/accounts';
import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';
import { calendarDayKeyFromDate, monthKeyFromDate } from '@motor/dinheiro/cash-out-periods.js';
import { resolveInstallmentDueDates } from './ExpenseInstallmentPreview';

type Props = {
    expense: Movement;
    account?: Account | null;
    loan: boolean;
    paidKeys: string[];
    currency?: string;
    now?: Date;
};

function formatDueDay(d: Date) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Cronograma de parcelas só leitura (modal de detalhe da saída).
 */
export function ExpenseInstallmentScheduleReadOnly({
    expense,
    account = null,
    loan,
    paidKeys,
    currency = 'BRL',
    now: nowProp
}: Props) {
    const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
    const n = Math.min(99, Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1));
    const amount = Number(expense.amount) || 0;
    const date = useMemo(() => {
        const raw = expense.date ?? expense.expenseDate ?? '';
        const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }, [expense]);
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

    if (isCredit && dueDates.length < 2) {
        const closeDay = account?.closeDay ?? account?.closingDay;
        const dueDay = account?.dueDay ?? account?.dueDate;
        if (!closeDay || !dueDay) {
            return (
                <p className="ui-form-hint-block expense-detail-modal__hint">
                    Cartão sem dia de fechamento/vencimento — não dá para calcular as parcelas. Ajuste o
                    cadastro da conta ou edite a saída para marcar pagamentos.
                </p>
            );
        }
    }

    if (dueDates.length < 2 && loan) {
        return (
            <p className="ui-form-hint-block expense-detail-modal__hint">
                Não foi possível montar o cronograma. Confira a data da saída e o número de parcelas na edição.
            </p>
        );
    }

    if (dueDates.length < 2) return null;

    const per = getExpensePerInstallmentDisplayAmount(expense, account ?? undefined);
    const lastDue = dueDates[dueDates.length - 1];

    const title = loan && !isCredit ? 'Empréstimo / parcelas fixas' : 'Parcelas no cartão';
    const circumference = 2 * Math.PI * 20;
    const frac = total > 0 ? paidCount / total : 0;
    const dashOffset = circumference * (1 - frac);

    return (
        <section className="expense-detail-modal__installments" aria-labelledby="expense-detail-installments-title">
            <h3 id="expense-detail-installments-title" className="expense-detail-modal__section-title">
                {title}
            </h3>
            <div className="expense-inst-preview expense-inst-preview--readonly" role="status">
                <div className="expense-inst-preview__summary">
                    <div className="expense-inst-preview__ring" aria-hidden="true">
                        <svg className="expense-inst-preview__ring-svg" viewBox="0 0 52 52" width="52" height="52">
                            <circle className="expense-inst-preview__ring-track" cx="26" cy="26" r={20} fill="none" />
                            <g transform="rotate(-90 26 26)">
                                <circle
                                    className="expense-inst-preview__ring-progress"
                                    cx="26"
                                    cy="26"
                                    r={20}
                                    fill="none"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                />
                            </g>
                        </svg>
                        <span className="expense-inst-preview__ring-num">{remaining}</span>
                    </div>
                    <div className="expense-inst-preview__copy">
                        <span className="expense-inst-preview__line">
                            <strong>{paidCount}</strong> pagas · <strong>{remaining}</strong> faltam ·{' '}
                            <strong>{total}</strong> no total
                        </span>
                        {Number.isFinite(per) && per > 0 ? (
                            <span className="expense-inst-preview__line">
                                Valor por parcela: <strong>{formatBRL(per, currency)}</strong>
                            </span>
                        ) : null}
                        <span className="expense-inst-preview__hint">
                            Término previsto: <strong>{formatDueDay(lastDue)}</strong>
                            {loan && !isCredit
                                ? ' · Datas mensais a partir da primeira parcela'
                                : ' · Vencimentos pelo ciclo do cartão'}
                        </span>
                    </div>
                </div>
            </div>
            <ol className="expense-detail-modal__schedule">
                {dueDates.map((d, i) => {
                    const pk = calendarDayKeyFromDate(d);
                    const mk = monthKeyFromDate(d);
                    const isPaid = paidSet.has(pk) || paidSet.has(mk);
                    const overdue = !isPaid && mk <= nowMk;
                    return (
                        <li
                            key={pk}
                            className={[
                                'expense-detail-modal__schedule-item',
                                isPaid ? 'is-paid' : overdue ? 'is-due' : 'is-pending'
                            ].join(' ')}
                        >
                            <span className="expense-detail-modal__schedule-index">
                                {i + 1}/{total}
                            </span>
                            <span className="expense-detail-modal__schedule-date">{formatDueDay(d)}</span>
                            <span className="expense-detail-modal__schedule-amount">{formatBRL(per, currency)}</span>
                            <span className="expense-detail-modal__schedule-status">
                                {isPaid ? 'Paga' : overdue ? 'Em atraso' : 'Pendente'}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className="expense-detail-modal__hint">
                Para marcar parcelas pagas, use <strong>Editar</strong> e toque nos meses no formulário.
            </p>
        </section>
    );
}
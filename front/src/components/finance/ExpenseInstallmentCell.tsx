import { useEffect, useMemo, useRef } from 'react';
import type { Account, Movement, UserProfile } from '../../lib/types/finance';
import {
    getExpenseInstallmentLabelParts,
    type InstallmentListPeriod
} from '../../frentes/dinheiro/domain/expenseInstallmentLabel';
import {
    buildExpenseInstallmentCellView,
    buildExpenseInstallmentCompactHoverHtml
} from '@motor/dinheiro/expense-installment-cell-view.js';
import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';

type Props = {
    expense: Movement;
    account?: Account;
    userProfile?: UserProfile | null;
    listPeriod?: InstallmentListPeriod | null;
    currency?: string;
    now?: Date;
};

/**
 * Coluna Parcelas: tag = restantes à frente (ou Quitada se a do mês estiver paga).
 * Hover compacto com parcela atual, valor e status.
 */
export function ExpenseInstallmentCell({
    expense,
    account,
    userProfile = null,
    listPeriod = null,
    currency = 'BRL',
    now
}: Props) {
    const nowDate = useMemo(() => now ?? new Date(), [now]);
    const popRef = useRef<HTMLSpanElement>(null);

    const view = useMemo(() => {
        const parts = getExpenseInstallmentLabelParts(
            expense,
            account,
            userProfile,
            nowDate,
            listPeriod
        );
        return buildExpenseInstallmentCellView(parts);
    }, [expense, account, userProfile, listPeriod, nowDate]);

    const panelHtml = useMemo(() => {
        if (!view) return '';
        const perAmount = getExpensePerInstallmentDisplayAmount(expense, account);
        return buildExpenseInstallmentCompactHoverHtml(view, { perAmount, currency });
    }, [view, expense, account, currency]);

    useEffect(() => {
        const pop = popRef.current;
        if (!pop || !panelHtml) return;
        const panel = pop.querySelector('.installment-tooltip-panel') as HTMLElement | null;
        if (!panel) return;

        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const place = () => {
            const r = pop.getBoundingClientRect();
            const pw = Math.min(280, Math.max(160, panel.offsetWidth || 200));
            let left = r.left + r.width / 2 - pw / 2;
            left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
            panel.style.width = `${pw}px`;
            panel.style.left = `${left}px`;
            panel.style.top = `${r.top}px`;
            panel.style.transform = 'translateY(-100%)';
        };

        const show = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            panel.classList.add('installment-tooltip-panel--visible');
            requestAnimationFrame(place);
        };

        const hide = () => panel.classList.remove('installment-tooltip-panel--visible');

        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(hide, 160);
        };

        const onPanelEnter = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        };

        pop.addEventListener('mouseenter', show);
        pop.addEventListener('mouseleave', scheduleHide);
        panel.addEventListener('mouseenter', onPanelEnter);
        panel.addEventListener('mouseleave', scheduleHide);
        pop.addEventListener('focus', show);
        pop.addEventListener('blur', hide);

        return () => {
            if (hideTimer) clearTimeout(hideTimer);
            pop.removeEventListener('mouseenter', show);
            pop.removeEventListener('mouseleave', scheduleHide);
            panel.removeEventListener('mouseenter', onPanelEnter);
            panel.removeEventListener('mouseleave', scheduleHide);
            pop.removeEventListener('focus', show);
            pop.removeEventListener('blur', hide);
            hide();
        };
    }, [panelHtml]);

    if (!view) {
        return (
            <span className="expenses-installment-cell expenses-installment-cell--empty" aria-hidden="true">
                —
            </span>
        );
    }

    const tone =
        view.tone === 'settled' ? 'expenses-installment-cell--settled' : 'expenses-installment-cell--open';

    return (
        <span
            ref={popRef}
            className={`installment-ring-popover expenses-installment-stack ${tone}`}
            tabIndex={0}
            aria-label={view.title}
        >
            <span className="expenses-installment-cell__label">{view.label}</span>
            {panelHtml ? <span dangerouslySetInnerHTML={{ __html: panelHtml }} /> : null}
        </span>
    );
}

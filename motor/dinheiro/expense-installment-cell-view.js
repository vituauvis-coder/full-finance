import { formatCurrency } from './format-currency.js';

/**
 * Modelo visual da coluna Parcelas — recorte do mês filtrado.
 * Conta quantas parcelas faltavam *depois* da parcela daquele mês (total − índice).
 * «Quitada» só no mês da última parcela (quando ela está paga).
 *
 * @param {{ total: number, paidCount: number, remaining: number, allPaid: boolean, monthParcel: { index: number, total: number|null, paid: boolean, scope: string }|null }|null|undefined} parts
 * @returns {{ label: string, monthLine: string, monthHint: string, title: string, tone: 'settled'|'open', monthNone: boolean, parcelIndex: number|null, parcelTotal: number|null, ahead: number|null, monthPaid: boolean }|null}
 */
export function buildExpenseInstallmentCellView(parts) {
    if (!parts || !Number.isFinite(parts.total) || parts.total < 2) return null;

    const total = parts.total;
    const paidCount = Math.min(total, Math.max(0, Number(parts.paidCount) || 0));
    const mp = parts.monthParcel;

    const paidHint =
        paidCount === 0
            ? 'Nenhuma parcela confirmada no caixa'
            : paidCount === 1
              ? '1 parcela paga'
              : `${paidCount} parcelas pagas`;

    if (mp && Number.isFinite(mp.index)) {
        const parcelTotal = Number.isFinite(mp.total) && mp.total >= 2 ? mp.total : total;
        const parcelIndex = Math.min(parcelTotal, Math.max(1, mp.index));
        // Parcelas que ainda vinham *depois* deste mês (recorte histórico).
        const ahead = Math.max(0, parcelTotal - parcelIndex);
        const isLast = parcelIndex >= parcelTotal;
        const monthPaid = !!mp.paid;

        if (isLast && monthPaid) {
            return {
                label: 'Quitada',
                monthLine: '',
                monthHint: `Última parcela (${parcelIndex}/${parcelTotal})`,
                title: [paidHint + ` de ${total}`, `Parcela ${parcelIndex}/${parcelTotal} — quitada neste mês`].join(
                    ' · '
                ),
                tone: 'settled',
                monthNone: false,
                parcelIndex,
                parcelTotal,
                ahead: 0,
                monthPaid: true
            };
        }

        // Meses anteriores ao fim do contrato: sempre o que faltava após aquele mês.
        // Na última ainda em aberto, conta ela mesma.
        const show = ahead > 0 ? ahead : 1;
        const label = show === 1 ? '1 restante' : `${show} restantes`;
        return {
            label,
            monthLine: '',
            monthHint: `Parcela ${parcelIndex} de ${parcelTotal} · ${show} após este mês`,
            title: [paidHint + ` de ${total}`, label, `Parcela ${parcelIndex}/${parcelTotal}`].join(' · '),
            tone: 'open',
            monthNone: false,
            parcelIndex,
            parcelTotal,
            ahead: show,
            monthPaid: false
        };
    }

    if (parts.allPaid) {
        return {
            label: 'Quitada',
            monthLine: '',
            monthHint: `Contrato quitado (${total}/${total})`,
            title: paidHint + ` de ${total}`,
            tone: 'settled',
            monthNone: true,
            parcelIndex: null,
            parcelTotal: total,
            ahead: 0,
            monthPaid: true
        };
    }

    const remaining = Math.max(0, Number(parts.remaining) || 0);
    if (remaining > 0) {
        const label = remaining === 1 ? '1 restante' : `${remaining} restantes`;
        return {
            label,
            monthLine: '',
            monthHint: `${paidCount} pagas · ${remaining} em aberto`,
            title: [paidHint + ` de ${total}`, label, 'Nenhuma parcela cai no período filtrado'].join(' · '),
            tone: 'open',
            monthNone: true,
            parcelIndex: null,
            parcelTotal: total,
            ahead: remaining,
            monthPaid: false
        };
    }

    return null;
}

/**
 * Hover enxuto: só parcela do mês e valor (restantes ficam na tag da tabela).
 *
 * @param {{ parcelIndex: number|null, parcelTotal: number|null }|null|undefined} view
 * @param {{ perAmount?: number, currency?: string }|null} [opts]
 * @returns {string}
 */
export function buildExpenseInstallmentCompactHoverHtml(view, opts = null) {
    if (!view) return '';

    const currency = opts?.currency || 'BRL';
    const per = Number(opts?.perAmount);
    const perStr = Number.isFinite(per) ? formatCurrency(per, currency) : '';

    const frac =
        view.parcelIndex != null && view.parcelTotal != null
            ? `${view.parcelIndex}/${view.parcelTotal}`
            : '';

    const parts = [frac, perStr].filter(Boolean);
    if (!parts.length) return '';

    return `<div class="installment-tooltip-panel installment-tooltip-panel--compact" role="tooltip">
  <p class="installment-tooltip-line"><strong>${parts[0]}</strong>${
      parts[1] ? ` · ${parts[1]}` : ''
  }</p>
</div>`;
}

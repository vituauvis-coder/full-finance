import { formatBRL } from '../../utils/map-utils';

type PayMethod = 'pix' | 'card';

export type PayMethodBreakdown = {
    pixPaid: number;
    cardCommitted: number;
    cardInstallmentMonthly?: number;
};

type Layout = 'inline' | 'grid';

type Props = {
    pay: PayMethodBreakdown;
    layout?: Layout;
    className?: string;
    cardHint?: boolean;
    /** Mantém a linha só decorativa (ex. dentro de botão de categoria). */
    ariaHidden?: boolean;
    'aria-label'?: string;
};

function PayChip({ method, amount }: { method: PayMethod; amount: number }) {
    const label = method === 'pix' ? 'Pix' : 'Cartão';
    return (
        <span className={`orc-pay-chip orc-pay-chip--${method}`}>
            <span className="orc-pay-chip__dot" aria-hidden />
            <span className="orc-pay-chip__lbl">{label}</span>
            <span className="orc-pay-chip__amt">{formatBRL(amount)}</span>
        </span>
    );
}

export function PayMethodChips({
    pay,
    layout = 'inline',
    className,
    cardHint = false,
    ariaHidden,
    'aria-label': ariaLabel
}: Props) {
    const rootClass = [
        'orc-pay-chips',
        layout === 'grid' ? 'orc-pay-chips--grid' : 'orc-pay-chips--inline',
        className
    ]
        .filter(Boolean)
        .join(' ');

    const hint =
        cardHint && pay.cardCommitted > 0 && (pay.cardInstallmentMonthly ?? 0) > 0
            ? `~${formatBRL(pay.cardInstallmentMonthly!)}/mês`
            : null;

    return (
        <div
            className={rootClass}
            {...(ariaHidden
                ? { 'aria-hidden': true }
                : { 'aria-label': ariaLabel ?? 'Pix e cartão' })}
        >
            <PayChip method="pix" amount={pay.pixPaid} />
            <span className="orc-pay-chips__card-wrap">
                <PayChip method="card" amount={pay.cardCommitted} />
                {hint ? <span className="orc-pay-chips__hint">{hint}</span> : null}
            </span>
        </div>
    );
}
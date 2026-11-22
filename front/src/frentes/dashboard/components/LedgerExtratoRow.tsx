import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { BusyButton } from '../../../components/ui/BusyButton';
import { formatBRL } from '../../../lib/format';
import type { DayDetailItem } from '../types/cashHeatmap';
import type { LedgerCashOutPaySlot } from '../domain/ledgerExtratoEnrichment';
import { ledgerBucketIcon, type LedgerVisualBucket } from '../domain/ledgerItemVisual';

type Props = {
    item: DayDetailItem & { bucket: LedgerVisualBucket };
    currency: string;
    day?: number;
    paySlot?: LedgerCashOutPaySlot;
    onConfirmCashOut?: () => void;
    confirmBusyKey?: string | null;
    variant?: 'ledger' | 'panel';
};

export function LedgerExtratoRow({
    item,
    currency,
    day,
    paySlot = 'none',
    onConfirmCashOut,
    confirmBusyKey,
    variant = 'ledger'
}: Props) {
    const sign =
        item.kind === 'gain'
            ? '+'
            : item.kind === 'invoice' || item.kind === 'rateio'
              ? ''
              : '−';
    const prefix = sign ? `${sign} ` : '';
    const bucket = item.bucket;
    const icon = ledgerBucketIcon(bucket, item.pending, item.kind);
    const confirmKey = item.cashOutConfirm
        ? `${item.cashOutConfirm.expenseId}:${item.cashOutConfirm.periodKey}`
        : null;
    const awaitingPay = paySlot === 'todo';
    const showPayColumn = item.kind === 'expense' || item.kind === 'invoice';
    const meta = [item.bank, item.tag].filter(Boolean).join(' · ');

    const rowClass = [
        'cash-heatmap-day-item',
        variant === 'ledger' ? 'dashboard-ledger-row dashboard-ledger-row--ledger' : 'cash-heatmap-day-item--compact',
        awaitingPay ? 'dashboard-ledger-row--awaiting-pay' : 'dashboard-ledger-row--settled'
    ]
        .filter(Boolean)
        .join(' ');

    const amountEl = (
        <span
            className={`cash-heatmap-day-item__amount cash-heatmap-day-item__amount--ledger cash-heatmap-day-item__amount--${bucket} dashboard-ledger-row__amount${
                item.estornoExpectativa ? ' cash-heatmap-day-item__amount--estorno-pending' : ''
            }`}
        >
            {prefix}
            {formatBRL(item.amount, currency)}
        </span>
    );

    const bucketIcon = (
        <span
            className={`cash-heatmap-day-item__icon cash-heatmap-day-item__icon--ledger cash-heatmap-day-item__icon--${bucket}${
                item.estornoExpectativa ? ' cash-heatmap-day-item__icon--pending' : ''
            }${item.rateioPendente ? ' cash-heatmap-day-item__icon--rateio-pending' : ''}`}
            aria-hidden
            title={bucket}
        >
            <MaterialIcon name={icon} variant="app" opticalSize={15} />
        </span>
    );

    const descEl = (
        <p className="dashboard-ledger-row__desc cash-heatmap-day-item__body">
            <span className="cash-heatmap-day-item__title">{item.title}</span>
            {meta ? <span className="cash-heatmap-day-item__meta"> · {meta}</span> : null}
        </p>
    );

    const payStatusEl =
        paySlot === 'todo' ? (
            <BusyButton
                type="button"
                className="dashboard-ledger-row__pay-todo"
                busy={confirmBusyKey === confirmKey}
                busyLabel="…"
                title="Confirmar pagamento no saldo"
                aria-label={`Confirmar pagamento: ${item.title}`}
                disabled={!onConfirmCashOut}
                onClick={onConfirmCashOut}
            >
                <span className="dashboard-ledger-row__pay-todo-ring" aria-hidden />
            </BusyButton>
        ) : paySlot === 'done' ? (
            <span className="dashboard-ledger-row__pay-done" title="Pago no saldo" aria-hidden>
                <MaterialIcon name="check" variant="app" opticalSize={15} />
            </span>
        ) : (
            <span className="dashboard-ledger-row__pay-none" aria-hidden />
        );

    if (variant === 'panel') {
        return (
            <li className={rowClass} data-ledger-bucket={bucket}>
                {bucketIcon}
                <div className="cash-heatmap-day-item__body">
                    <span className="cash-heatmap-day-item__title">{item.title}</span>
                    {meta ? <span className="cash-heatmap-day-item__meta">{meta}</span> : null}
                </div>
                {amountEl}
            </li>
        );
    }

    return (
        <li className={rowClass} data-ledger-bucket={bucket}>
            <span className="dashboard-ledger-row__day-num" aria-label={day != null ? `Dia ${day}` : undefined}>
                {day ?? '·'}
            </span>
            <span
                className={`dashboard-ledger-row__check-slot${
                    showPayColumn ? ' dashboard-ledger-row__check-slot--visible' : ''
                }`}
            >
                {payStatusEl}
            </span>
            {bucketIcon}
            {descEl}
            {amountEl}
        </li>
    );
}
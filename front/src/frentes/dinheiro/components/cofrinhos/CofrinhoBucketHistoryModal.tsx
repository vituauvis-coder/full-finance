import { useMemo } from 'react';
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogHeader,
    DialogPanel,
    DialogTitle
} from '../../../../components/ui/dialog/Dialog';
import { formatBRL } from '../../../../lib/format';
import { accountName, formatMovementDate } from '../../../../lib/movementList';
import { MONTH_NAMES } from '../../../../lib/period';
import type { Account } from '../../../../lib/types/finance';
import { type CofrinhoApplication, type CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { collectCofrinhoInflowEvents } from '../../domain/cofrinhoInflowEvents';
import type { Movement } from '../../../../lib/types/finance';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import { cofrinhoKindMeta } from '../../domain/cofrinhoBucketTypes';
import type { CofrinhoInflowEvent } from '../../domain/cofrinhoInflowEvents';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    open: boolean;
    onClose: () => void;
    bucket: CofrinhoBucket | null;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    accounts: Account[];
    currency: string;
};

function refMonthLabelFromYm(ym: string): string {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    const mi = Math.min(11, Math.max(0, parseInt(m, 10) - 1));
    return `${MONTH_NAMES[mi]}/${y}`;
}

function registeredOn(ev: CofrinhoInflowEvent): string {
    if (!ev.sortAt) return '—';
    return formatMovementDate({ date: ev.sortAt });
}

const STATEMENT_COLS = 'cofrinho-statement__cols';

export function CofrinhoBucketHistoryModal({
    open,
    onClose,
    bucket,
    buckets,
    applications,
    expenses,
    accounts,
    currency
}: Props) {
    const rows = useMemo(() => {
        if (!bucket) return [];
        return collectCofrinhoInflowEvents(buckets, applications, expenses).filter(
            (ev) => ev.bucketId === bucket.id
        );
    }, [applications, bucket, buckets, expenses]);

    const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

    if (!bucket) return null;

    const kind = cofrinhoKindMeta(bucket);
    const title = bucket.name ?? 'Caixinha';
    const accent = bucketColorHex(bucket.colorKey);

    return (
        <Dialog open={open} onClose={onClose} id="cofrinho-bucket-history-modal">
            <DialogPanel
                size="lg"
                className="cofrinho-history-dialog"
                style={{ ['--cofrinho-accent' as string]: accent }}
            >
                <DialogHeader>
                    <DialogTitle>Histórico — {title}</DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>
                <DialogBody className="cofrinho-history-dialog__body">
                    <div className="cofrinho-statement__hero" aria-label="Resumo da caixinha">
                        <span className="cofrinho-statement__hero-kind">
                            <MaterialIcon name={kind.icon} variant="app" opticalSize={15} />
                            {kind.shortLabel}
                        </span>
                        <span className="cofrinho-statement__hero-label">Total alocado</span>
                        <strong className="cofrinho-statement__hero-value">
                            {formatBRL(total, currency)}
                        </strong>
                        <span className="cofrinho-statement__hero-count">
                            {rows.length} aporte{rows.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {rows.length === 0 ? (
                        <p className="cofrinho-history-dialog__empty">Nenhum aporte nesta caixinha ainda.</p>
                    ) : (
                        <div className="cofrinho-statement" role="table" aria-label="Extrato de aportes">
                            <div className={`cofrinho-statement__header ${STATEMENT_COLS}`} role="row">
                                <span role="columnheader">Mês ref.</span>
                                <span role="columnheader">Conta</span>
                                <span role="columnheader">Registro</span>
                                <span role="columnheader" className="cofrinho-statement__th-amount">
                                    Valor
                                </span>
                            </div>
                            <ul className="cofrinho-statement__rows" role="rowgroup">
                                {rows.map((ev) => {
                                    const account = accountName(accounts, ev.accountId);
                                    return (
                                        <li key={ev.id} className={`cofrinho-statement__row ${STATEMENT_COLS}`} role="row">
                                            <span className="cofrinho-statement__ref" role="cell">
                                                {refMonthLabelFromYm(ev.yearMonth)}
                                            </span>
                                            <span className="cofrinho-statement__account" role="cell" title={account}>
                                                <MaterialIcon
                                                    name="south_west"
                                                    variant="app"
                                                    opticalSize={14}
                                                    className="cofrinho-statement__flow-icon"
                                                />
                                                <span className="cofrinho-statement__account-name">{ev.title}</span>
                                                <span className="cofrinho-statement__status is-done">Aporte</span>
                                            </span>
                                            <span className="cofrinho-statement__date" role="cell">
                                                {registeredOn(ev)}
                                            </span>
                                            <span className="cofrinho-statement__amount" role="cell">
                                                {formatBRL(ev.amount, currency)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </DialogBody>
            </DialogPanel>
        </Dialog>
    );
}
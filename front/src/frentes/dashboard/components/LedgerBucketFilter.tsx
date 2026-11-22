import { useCallback, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    LEDGER_BUCKET_ICONS,
    LEDGER_BUCKET_LABELS,
    LEDGER_FILTER_ORDER,
    type LedgerVisualBucket
} from '../domain/ledgerItemVisual';

type Props = {
    counts: Partial<Record<LedgerVisualBucket, number>>;
    hidden: ReadonlySet<LedgerVisualBucket>;
    onToggle: (bucket: LedgerVisualBucket) => void;
    onShowAll: () => void;
};

export function LedgerBucketFilter({ counts, hidden, onToggle, onShowAll }: Props) {
    const anyHidden = hidden.size > 0;

    return (
        <div className="dashboard-ledger-filter" role="toolbar" aria-label="Filtrar extrato por tipo">
            <button
                type="button"
                className={`dashboard-ledger-filter__chip dashboard-ledger-filter__chip--all${
                    !anyHidden ? ' is-active' : ''
                }`}
                aria-pressed={!anyHidden}
                onClick={onShowAll}
                title="Mostrar todos"
            >
                Todos
            </button>
            {LEDGER_FILTER_ORDER.map((bucket) => {
                const n = counts[bucket] ?? 0;
                const isOn = !hidden.has(bucket);
                return (
                    <button
                        key={bucket}
                        type="button"
                        className={`dashboard-ledger-filter__chip dashboard-ledger-filter__chip--${bucket}${
                            isOn ? ' is-active' : ''
                        }`}
                        aria-pressed={isOn}
                        aria-label={`${LEDGER_BUCKET_LABELS[bucket]}${n > 0 ? `, ${n}` : ''}`}
                        title={LEDGER_BUCKET_LABELS[bucket]}
                        disabled={n === 0}
                        onClick={() => onToggle(bucket)}
                    >
                        <MaterialIcon name={LEDGER_BUCKET_ICONS[bucket]} variant="app" opticalSize={18} />
                        {n > 0 ? <span className="dashboard-ledger-filter__count">{n}</span> : null}
                    </button>
                );
            })}
        </div>
    );
}

export function useLedgerBucketFilter() {
    const [hidden, setHidden] = useState<Set<LedgerVisualBucket>>(() => new Set());

    const toggle = useCallback((bucket: LedgerVisualBucket) => {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(bucket)) next.delete(bucket);
            else next.add(bucket);
            return next;
        });
    }, []);

    const showAll = useCallback(() => setHidden(new Set()), []);

    return { hidden, toggle, showAll };
}
import { formatBRL } from '../../../../lib/format';
import {
    getBucketGoalForYear,
    sumAllocatedByBucket,
    type CofrinhoApplication,
    type CofrinhoBucket,
    type CofrinhoBucketGoal
} from '../../domain/cofrinhoAggregations';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import { cofrinhoKindMeta } from '../../domain/cofrinhoBucketTypes';
import type { Movement } from '../../../../lib/types/finance';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    bucket: CofrinhoBucket;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    goals: CofrinhoBucketGoal[];
    currency: string;
    goalYear: number;
    onEdit: (bucket: CofrinhoBucket) => void;
    onAllocate: (bucketId: string) => void;
    onOpenHistory: (bucket: CofrinhoBucket) => void;
    onReconcile: (bucket: CofrinhoBucket) => void;
};

export function CofrinhoBucketCard({
    bucket,
    buckets,
    applications,
    expenses,
    goals,
    currency,
    goalYear,
    onEdit,
    onAllocate,
    onOpenHistory,
    onReconcile
}: Props) {
    const name = bucket.name ?? 'Caixinha';
    const kindMeta = cofrinhoKindMeta(bucket);
    const hex = bucketColorHex(bucket.colorKey);
    const resultado = sumAllocatedByBucket(expenses, bucket, applications, buckets);
    const goal = getBucketGoalForYear(goals, bucket.id, goalYear);
    const meta = goal ? Number(goal.targetAmount) || 0 : 0;
    const perc = meta > 0 ? Math.min((resultado / meta) * 100, 100) : 0;
    const done = meta > 0 && resultado >= meta;

    return (
        <li
            className="cofrinho-bucket-table__row"
            role="row"
            data-bucket-id={bucket.id}
            data-bucket-kind={kindMeta.value}
            style={{ ['--cofrinho-accent' as string]: hex }}
        >
            <button
                type="button"
                className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--name"
                role="cell"
                aria-label={`Ver histórico — ${name}`}
                onClick={() => onOpenHistory(bucket)}
            >
                <span className="cofrinho-bucket-table__icon" aria-hidden>
                    <MaterialIcon name={kindMeta.icon} variant="app" opticalSize={18} filled />
                </span>
                <span className="cofrinho-bucket-table__name-wrap">
                    <span className="cofrinho-bucket-table__name">{name}</span>
                    <span className="cofrinho-bucket-table__kind">{kindMeta.shortLabel}</span>
                </span>
            </button>

            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--valor" role="cell">
                <strong className="cofrinho-bucket-table__valor">{formatBRL(resultado, currency)}</strong>
            </span>

            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--meta" role="cell">
                {meta > 0 ? (
                    <strong className="cofrinho-bucket-table__meta-amount">{formatBRL(meta, currency)}</strong>
                ) : (
                    <span className="cofrinho-bucket-table__meta-unset">—</span>
                )}
            </span>

            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--progress" role="cell">
                {done ? <span className="cofrinho-bucket-table__done">Atingida</span> : null}
                {meta > 0 ? (
                    <>
                        <span className="cofrinho-bucket-table__progress-pct">{Math.round(perc)}%</span>
                        <span
                            className="cofrinho-bucket-table__progress"
                            role="progressbar"
                            aria-valuenow={Math.round(perc)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${Math.round(perc)}% da meta`}
                        >
                            <span style={{ width: `${perc.toFixed(1)}%` }} />
                        </span>
                    </>
                ) : (
                    <span className="cofrinho-bucket-table__meta-unset">Sem meta em {goalYear}</span>
                )}
            </span>

            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--actions" role="cell">
                <button
                    type="button"
                    className="cofrinho-bucket-table__aportar"
                    onClick={() => onAllocate(bucket.id)}
                >
                    <MaterialIcon name="add" variant="app" opticalSize={17} />
                    Aportar
                </button>
                <button
                    type="button"
                    className="cofrinho-bucket-table__reconcile"
                    title="Atualizar saldo mensal"
                    aria-label={`Atualizar saldo com rendimento — ${name}`}
                    onClick={() => onReconcile(bucket)}
                >
                    <MaterialIcon name="monitoring" variant="app" opticalSize={16} />
                </button>
                <button
                    type="button"
                    className="cofrinho-bucket-table__edit"
                    title="Configurar"
                    aria-label={`Configurar — ${name}`}
                    onClick={() => onEdit(bucket)}
                >
                    <MaterialIcon name="edit" variant="app" opticalSize={16} />
                </button>
            </span>
        </li>
    );
}
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
import type { CofrinhoMonthlyBalance } from '../../domain/cofrinhoMonthlyBalances';
import { cofrinhoBucketRegisteredYield } from '../../domain/cofrinhoSummaryStats';
import {
    cofrinhoGoalDeadlineFromGoal,
    formatCofrinhoGoalDeadlineLabel
} from '../../domain/cofrinhoGoalDeadline';
import { cofrinhoGoalMonthsUntilDeadline } from '@motor/dinheiro/cofrinho-goal-pace.js';
import { cofrinhoMonthlyPaceToGoal } from '@motor/dinheiro/cofrinho-goal-pace.js';

type Props = {
    bucket: CofrinhoBucket;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    goals: CofrinhoBucketGoal[];
    monthlyBalances: CofrinhoMonthlyBalance[];
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
    monthlyBalances,
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
    const contributed = sumAllocatedByBucket(expenses, bucket, applications, buckets);
    const rendeu = cofrinhoBucketRegisteredYield(bucket.id, monthlyBalances);
    const accumulated = Math.round((contributed + rendeu) * 100) / 100;
    const goal = getBucketGoalForYear(goals, bucket.id, goalYear);
    const meta = goal ? Number(goal.targetAmount) || 0 : 0;
    const deadlineIso = cofrinhoGoalDeadlineFromGoal(goal);
    const metaDeadline = deadlineIso ? formatCofrinhoGoalDeadlineLabel(deadlineIso) : '';
    const perc = meta > 0 ? Math.min((accumulated / meta) * 100, 100) : 0;
    const done = meta > 0 && accumulated >= meta;
    const hasYield = rendeu > 0.004;
    const pace =
        meta > 0 && deadlineIso
            ? cofrinhoMonthlyPaceToGoal(meta, accumulated, deadlineIso, new Date())
            : null;
    const monthsUntilDeadline =
        deadlineIso && !pace ? cofrinhoGoalMonthsUntilDeadline(deadlineIso, new Date()) : pace?.monthsLeft;

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

            <span
                className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--meta cofrinho-bucket-table__cell--num"
                role="cell"
            >
                {meta > 0 ? (
                    <span className="cofrinho-bucket-table__meta-stack">
                        <span className="cofrinho-bucket-table__meta-amount">{formatBRL(meta, currency)}</span>
                        {metaDeadline ? (
                            <span className="cofrinho-bucket-table__meta-deadline" title="Prazo da meta">
                                até {metaDeadline}
                            </span>
                        ) : null}
                    </span>
                ) : metaDeadline ? (
                    <span className="cofrinho-bucket-table__meta-stack">
                        <span className="cofrinho-bucket-table__meta-deadline" title="Prazo da meta">
                            até {metaDeadline}
                        </span>
                    </span>
                ) : (
                    <span className="cofrinho-bucket-table__meta-unset">—</span>
                )}
            </span>

            <span
                className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--valor cofrinho-bucket-table__cell--num"
                role="cell"
            >
                <strong className="cofrinho-bucket-table__valor">{formatBRL(contributed, currency)}</strong>
            </span>

            <span
                className={`cofrinho-bucket-table__cell cofrinho-bucket-table__cell--yield cofrinho-bucket-table__cell--num${hasYield ? ' has-yield-delta' : ''}`}
                role="cell"
            >
                <strong className="cofrinho-bucket-table__yield-total">{formatBRL(accumulated, currency)}</strong>
                {hasYield ? (
                    <span className="cofrinho-bucket-table__yield-delta">+{formatBRL(rendeu, currency)}</span>
                ) : null}
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

            <span
                className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--pace cofrinho-bucket-table__cell--num"
                role="cell"
                title={
                    pace && pace.monthsLeft > 0
                        ? `Faltam ${formatBRL(pace.remaining, currency)} em ${pace.monthsLeft} mês(es)`
                        : undefined
                }
            >
                {done || pace?.perMonth === 0 ? (
                    <span className="cofrinho-bucket-table__pace-done">—</span>
                ) : pace && pace.perMonth > 0.004 ? (
                    <span className="cofrinho-bucket-table__pace-stack">
                        <strong className="cofrinho-bucket-table__pace-value">
                            +{formatBRL(pace.perMonth, currency)}
                        </strong>
                        <span className="cofrinho-bucket-table__pace-hint">/mês · {pace.monthsLeft}m</span>
                    </span>
                ) : meta > 0 && deadlineIso && monthsUntilDeadline == null ? (
                    <span className="cofrinho-bucket-table__meta-unset" title="Prazo já passou">
                        Prazo vencido
                    </span>
                ) : meta > 0 && !deadlineIso ? (
                    <span className="cofrinho-bucket-table__meta-unset" title="Defina o prazo na configuração da caixinha">
                        Sem prazo
                    </span>
                ) : (
                    <span className="cofrinho-bucket-table__meta-unset">—</span>
                )}
            </span>

            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--actions" role="cell">
                <button
                    type="button"
                    className="cofrinho-bucket-table__aportar"
                    title="Aportar"
                    aria-label={`Aportar — ${name}`}
                    onClick={() => onAllocate(bucket.id)}
                >
                    <MaterialIcon name="add" variant="app" opticalSize={17} />
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
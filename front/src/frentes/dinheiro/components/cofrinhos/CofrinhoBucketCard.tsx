import { formatBRL } from '../../../../lib/format';
import {
    getBucketGoalForYear,
    sumAllocatedByBucket,
    type CofrinhoApplication,
    type CofrinhoBucket,
    type CofrinhoBucketGoal
} from '../../domain/cofrinhoAggregations';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import type { Movement } from '../../../../lib/types/finance';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { CofrinhoBucketColorPicker } from './CofrinhoBucketColorPicker';
import { updateCofrinhoBucket } from '../../api/cofrinhos';

type Props = {
    bucket: CofrinhoBucket;
    applications: CofrinhoApplication[];
    expenses: Movement[];
    goals: CofrinhoBucketGoal[];
    currency: string;
    goalYear: number;
    onEdit: (bucket: CofrinhoBucket) => void;
    onAllocate: (bucketId: string) => void;
    onRefresh: () => Promise<void>;
};

export function CofrinhoBucketCard({
    bucket,
    applications,
    expenses,
    goals,
    currency,
    goalYear,
    onEdit,
    onAllocate,
    onRefresh
}: Props) {
    const name = bucket.name ?? 'Caixinha';
    const hex = bucketColorHex(bucket.colorKey);
    const resultado = sumAllocatedByBucket(expenses, bucket, applications);
    const goal = getBucketGoalForYear(goals, bucket.id, goalYear);
    const meta = goal ? Number(goal.targetAmount) || 0 : 0;
    const perc = meta > 0 ? Math.min((resultado / meta) * 100, 100) : 0;
    const done = meta > 0 && resultado >= meta;

    return (
        <article
            className="zero-budget__block-card cofrinho-bucket-card"
            data-bucket-id={bucket.id}
            style={{ ['--zb-accent' as string]: hex }}
        >
            <header className="zero-budget__block-head">
                <div className="zero-budget__block-title-row">
                    <span className="zero-budget__block-dot" style={{ backgroundColor: hex }} aria-hidden="true" />
                    <h3 className="zero-budget__block-title">{name}</h3>
                </div>
                {done ? <span className="cofrinho-bucket-card__done">Concluído</span> : null}
                <button
                    type="button"
                    className="zero-budget__block-delete"
                    title="Definições da caixinha"
                    aria-label={`Definições — ${name}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(bucket);
                    }}
                >
                    <MaterialIcon name="settings" variant="app" filled={false} weight={500} opticalSize={20} />
                </button>
            </header>

            <div className="zero-budget__block-amount-wrap">
                <span className="zero-budget__block-amount-value cofrinho-bucket-card__amount">{formatBRL(resultado, currency)}</span>
            </div>

            <p className="zero-budget__block-slider-meta">
                {meta > 0 ? (
                    <>
                        <span>de {formatBRL(meta, currency)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{Math.round(perc)}% da meta</span>
                    </>
                ) : (
                    <span className="cofrinho-bucket-card__meta-unset">Meta não definida</span>
                )}
            </p>

            <div
                className="cofrinho-bucket-card__progress"
                role="progressbar"
                aria-valuenow={Math.round(perc)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso da meta"
            >
                <span style={{ width: `${perc.toFixed(1)}%`, backgroundColor: hex }} />
            </div>

            <footer className="zero-budget__block-foot cofrinho-bucket-card__foot">
                <CofrinhoBucketColorPicker
                    bucketName={name}
                    selectedKey={bucket.colorKey}
                    onSelect={async (colorKey) => {
                        await updateCofrinhoBucket(bucket.id, { colorKey });
                        await onRefresh();
                    }}
                />
                <div className="cofrinho-bucket-card__actions">
                    <button type="button" className="zero-budget__block-list-btn" onClick={() => onAllocate(bucket.id)}>
                        <MaterialIcon name="add" variant="app" filled={false} weight={500} opticalSize={20} />
                        Aportar
                    </button>
                </div>
            </footer>
        </article>
    );
}
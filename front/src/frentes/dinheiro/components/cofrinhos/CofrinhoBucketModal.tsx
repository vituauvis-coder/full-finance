import { type FormEvent, useEffect, useState } from 'react';
import { ZeroBudgetLegacyModal } from '../ZeroBudgetLegacyModal';
import {
    BUCKET_COLOR_KEYS,
    BUCKET_COLOR_LABELS,
    bucketColorHex,
    type BucketColorKey
} from '../../domain/cofrinhoConstants';
import {
    createCofrinhoBucket,
    deleteCofrinhoBucket,
    updateCofrinhoBucket,
    upsertBucketGoal
} from '../../api/cofrinhos';
import type { CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import { getBucketGoalForYear } from '../../domain/cofrinhoAggregations';
import { useConfirm } from '../../../../components/ui/confirm';

type Props = {
    open: boolean;
    onClose: () => void;
    editing: CofrinhoBucket | null;
    goals: CofrinhoBucketGoal[];
    goalYear: number;
    onSaved: () => Promise<void>;
};

export function CofrinhoBucketModal({ open, onClose, editing, goals, goalYear, onSaved }: Props) {
    const { confirm } = useConfirm();
    const [name, setName] = useState('');
    const [colorKey, setColorKey] = useState<BucketColorKey>('violet');
    const [yieldMultiplier, setYieldMultiplier] = useState('1.02');
    const [goalTarget, setGoalTarget] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = editing ? 'Editar caixinha' : 'Nova caixinha';

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setName(editing.name ?? '');
            setColorKey((editing.colorKey as BucketColorKey) ?? 'violet');
            setYieldMultiplier(String(editing.yieldMultiplier ?? 1.02));
            const goal = getBucketGoalForYear(goals, editing.id, goalYear);
            setGoalTarget(goal?.targetAmount != null ? String(goal.targetAmount) : '');
        } else {
            setName('');
            setColorKey('violet');
            setYieldMultiplier('1.02');
            setGoalTarget('');
        }
    }, [editing, goalYear, goals, open]);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Informe o nome da caixinha');
            return;
        }
        const yMult = parseFloat(yieldMultiplier);
        const target = goalTarget.trim() ? parseFloat(goalTarget) : 0;

        setSaving(true);
        setError(null);
        try {
            let bucketId = editing?.id;
            if (editing) {
                await updateCofrinhoBucket(editing.id, {
                    name: trimmed,
                    colorKey,
                    yieldMultiplier: Number.isFinite(yMult) ? yMult : 1.02
                });
            } else {
                const created = await createCofrinhoBucket({
                    name: trimmed,
                    colorKey,
                    icon: 'fa-chart-line',
                    yieldMultiplier: Number.isFinite(yMult) ? yMult : 1.02
                });
                bucketId = created.id;
            }

            if (bucketId && Number.isFinite(target) && target > 0) {
                const existing = getBucketGoalForYear(goals, bucketId, goalYear);
                await upsertBucketGoal({
                    bucketId,
                    year: goalYear,
                    targetAmount: target,
                    goalId: existing?.id ?? null
                });
            }

            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível guardar');
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!editing) return;
        const ok = await confirm({
            title: 'Excluir caixinha?',
            message: 'Só é possível excluir caixinhas sem aportes registados.',
            confirmLabel: 'Excluir',
            tone: 'danger'
        });
        if (!ok) return;
        setSaving(true);
        setError(null);
        try {
            await deleteCofrinhoBucket(editing.id);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível excluir');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ZeroBudgetLegacyModal
            open={open}
            onClose={onClose}
            id="cofrinho-buckets-modal"
            contentClassName="cofrinho-modal cofrinho-modal--bucket modal-content--cofrinho-bucket"
            labelledBy="cofrinho-buckets-modal-title"
        >
            <div className="cofrinho-modal__header">
                <h3 id="cofrinho-buckets-modal-title">
                    <i className="fas fa-piggy-bank" aria-hidden="true"></i> {title}
                </h3>
                <button type="button" className="modal-close-btn cofrinho-modal__close" aria-label="Fechar" onClick={onClose}>
                    &times;
                </button>
            </div>
            <form id="cofrinho-bucket-form" className="cofrinho-bucket-form" onSubmit={(e) => void onSubmit(e)}>
                <div className="cofrinho-modal__body">
                    {error ? (
                        <div className="form-message" role="alert">
                            {error}
                        </div>
                    ) : null}

                    <div className="form-group cofrinho-bucket-form__name">
                        <label htmlFor="cofrinho-bucket-name">Nome</label>
                        <input
                            type="text"
                            id="cofrinho-bucket-name"
                            maxLength={120}
                            required
                            placeholder="Ex.: Reserva de emergência"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="cofrinho-bucket-form__panel" aria-labelledby="cofrinho-bucket-goal-label">
                        <p id="cofrinho-bucket-goal-label" className="cofrinho-bucket-form__panel-title">
                            Meta anual
                        </p>
                        <div className="cofrinho-bucket-form__goal-grid">
                            <div className="form-group cofrinho-bucket-form__field--year">
                                <label htmlFor="cofrinho-bucket-goal-year">Ano</label>
                                <select id="cofrinho-bucket-goal-year" aria-label="Ano da meta" value={String(goalYear)} disabled>
                                    <option value={goalYear}>{goalYear}</option>
                                </select>
                            </div>
                            <div className="form-group cofrinho-bucket-form__field--target">
                                <label htmlFor="cofrinho-bucket-goal-target">Valor (R$)</label>
                                <input
                                    type="number"
                                    id="cofrinho-bucket-goal-target"
                                    step="0.01"
                                    min="0"
                                    placeholder="5000"
                                    inputMode="decimal"
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="cofrinho-bucket-form__panel-hint">
                            Aparece nos cartões como «de R$ …» no ano escolhido.
                        </p>
                    </div>

                    <div className="form-group cofrinho-bucket-form__colors-wrap">
                        <span className="cofrinho-bucket-form__panel-title" id="cofrinho-bucket-color-label">
                            Cor
                        </span>
                        <div
                            className="zero-budget__colors-list cofrinho-bucket-form__colors"
                            role="radiogroup"
                            aria-labelledby="cofrinho-bucket-color-label"
                        >
                            {BUCKET_COLOR_KEYS.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`zero-budget__color-swatch${colorKey === key ? ' is-selected' : ''}`}
                                    style={{ backgroundColor: bucketColorHex(key) }}
                                    aria-label={BUCKET_COLOR_LABELS[key]}
                                    aria-pressed={colorKey === key}
                                    onClick={() => setColorKey(key)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="form-group cofrinho-bucket-form__yield">
                        <label htmlFor="cofrinho-bucket-yield">Rentabilidade mensal (mult.)</label>
                        <input
                            type="number"
                            id="cofrinho-bucket-yield"
                            step="0.001"
                            min="1"
                            max="2"
                            value={yieldMultiplier}
                            onChange={(e) => setYieldMultiplier(e.target.value)}
                            aria-describedby="cofrinho-bucket-yield-hint"
                        />
                        <p id="cofrinho-bucket-yield-hint" className="cofrinho-bucket-form__field-hint">
                            Ex.: 1,07 ≈ 7% ao mês nos gráficos.
                        </p>
                    </div>
                </div>

                <div className="cofrinho-modal__footer cofrinho-bucket-form__footer">
                    {editing ? (
                        <button
                            type="button"
                            id="cofrinho-bucket-delete"
                            className="cofrinho-bucket-form__delete"
                            disabled={saving}
                            onClick={() => void onDelete()}
                        >
                            Excluir caixinha
                        </button>
                    ) : (
                        <span aria-hidden="true" />
                    )}
                    <div className="cofrinho-bucket-form__footer-actions">
                        <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" id="cofrinho-bucket-submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Guardando…' : editing ? 'Guardar' : 'Adicionar caixinha'}
                        </button>
                    </div>
                </div>
            </form>
        </ZeroBudgetLegacyModal>
    );
}
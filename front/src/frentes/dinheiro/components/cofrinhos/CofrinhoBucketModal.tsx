import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogFooter,
    DialogForm,
    DialogHeader,
    DialogPanel,
    DialogTitle
} from '../../../../components/ui/dialog/Dialog';
import { FormField, FormInput, FormSelect } from '../../../../components/ui/form';
import { DatePicker } from '../../../../components/ui/date-picker/DatePicker';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { isPresetBucketColorKey } from '../../domain/cofrinhoConstants';
import { CofrinhoBucketColorSwatches, defaultBucketColorKey } from './CofrinhoBucketColorSwatches';
import {
    bucketGoalHasDeadline,
    createCofrinhoBucket,
    deleteCofrinhoBucket,
    updateCofrinhoBucket,
    upsertBucketGoal
} from '../../api/cofrinhos';
import type { CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import { getBucketGoalForYear } from '../../domain/cofrinhoAggregations';
import {
    COFRINHO_KIND_META,
    isTripLockedBucket,
    normalizeUserCofrinhoKind,
    resolveCofrinhoKind,
    type BucketFormKind
} from '../../domain/cofrinhoBucketTypes';
import { useConfirm } from '../../../../components/ui/confirm';
import { CofrinhoBucketGoalInput } from './CofrinhoBucketGoalInput';
import { CofrinhoBucketTypePicker } from './CofrinhoBucketTypePicker';
import { formatBRL } from '../../../../lib/format';
import { parseMoneyInput } from '../../domain/parseMoneyInput';
import { fetchTripsList } from '../../../viagens/api/trips';
import { cofrinhoGoalDeadlineInputValue } from '../../domain/cofrinhoGoalDeadline';
import { coerceDayKey } from '../../../../lib/calendarUi';

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
    const [kind, setKind] = useState<BucketFormKind>('objetivo');
    const [tripId, setTripId] = useState('');
    const [trips, setTrips] = useState<{ id: string; title: string }[]>([]);
    const [tripsLoading, setTripsLoading] = useState(false);
    const [tripsLoadError, setTripsLoadError] = useState<string | null>(null);
    const [colorKey, setColorKey] = useState<string>(defaultBucketColorKey());
    const [goalTarget, setGoalTarget] = useState('');
    const [goalDeadline, setGoalDeadline] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tripLocked = editing ? isTripLockedBucket(editing) : false;
    const isViagem = kind === 'viagem' || tripLocked;
    const title = editing ? 'Configurar caixinha' : 'Nova caixinha';

    const tripTitleById = useMemo(() => new Map(trips.map((t) => [t.id, t.title])), [trips]);

    const selectableTrips = trips;
    const linkedTripId = tripLocked ? String(editing?.tripId ?? '').trim() : tripId;
    const linkedTripTitle =
        tripTitleById.get(linkedTripId) ||
        (tripLocked && editing?.name ? editing.name : '') ||
        'Viagem';

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setName(editing.name ?? '');
            const resolved = resolveCofrinhoKind(editing);
            setKind(tripLocked ? 'viagem' : resolved === 'viagem' ? 'viagem' : normalizeUserCofrinhoKind(resolved));
            setTripId(String(editing.tripId ?? '').trim());
            setColorKey(editing.colorKey ?? COFRINHO_KIND_META[resolved].defaultColor);
            const goal = getBucketGoalForYear(goals, editing.id, goalYear);
            const target = goal?.targetAmount != null ? Number(goal.targetAmount) : 0;
            setGoalTarget(Number.isFinite(target) && target > 0 ? formatBRL(target, 'BRL') : '');
            setGoalDeadline(cofrinhoGoalDeadlineInputValue(goal?.targetDeadline));
        } else {
            setName('');
            setKind('objetivo');
            setTripId('');
            setColorKey(COFRINHO_KIND_META.objetivo.defaultColor);
            setGoalTarget('');
            setGoalDeadline('');
        }
    }, [editing, goalYear, goals, open, tripLocked]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setTripsLoading(true);
        setTripsLoadError(null);
        void fetchTripsList()
            .then((res) => {
                if (cancelled) return;
                setTrips(
                    (res.trips ?? []).map((t) => ({
                        id: t.id,
                        title: String(t.title ?? '').trim() || 'Viagem'
                    }))
                );
            })
            .catch((err) => {
                if (!cancelled) {
                    setTrips([]);
                    setTripsLoadError(
                        err instanceof Error ? err.message : 'Não foi possível carregar as viagens'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setTripsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    function onKindChange(next: BucketFormKind) {
        setKind(next);
        if (!editing && isPresetBucketColorKey(COFRINHO_KIND_META[next].defaultColor)) {
            setColorKey(COFRINHO_KIND_META[next].defaultColor);
        }
        if (next !== 'viagem') setTripId('');
    }

    useEffect(() => {
        if (!isViagem || tripLocked || !tripId || editing) return;
        const tripTitle = tripTitleById.get(tripId);
        if (tripTitle) setName(tripTitle);
    }, [isViagem, tripId, tripTitleById, tripLocked, editing]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        let trimmed = name.trim();
        if (isViagem && !tripLocked) {
            if (!tripId) {
                setError('Selecione a viagem para vincular a caixinha.');
                return;
            }
            const fromTrip = tripTitleById.get(tripId);
            if (fromTrip) trimmed = fromTrip;
        }
        if (!trimmed) {
            setError('Informe o nome da caixinha');
            return;
        }
        const yMult = Number(editing?.yieldMultiplier) || 1.02;
        const existingGoal = editing ? getBucketGoalForYear(goals, editing.id, goalYear) : undefined;
        const parsedTarget = goalTarget.trim() ? parseMoneyInput(goalTarget) : null;
        const target = parsedTarget != null ? parsedTarget : 0;
        const existingTarget =
            existingGoal?.targetAmount != null ? Number(existingGoal.targetAmount) || 0 : 0;
        const effectiveTarget =
            Number.isFinite(target) && target > 0 ? target : existingTarget > 0 ? existingTarget : 0;
        const deadline = coerceDayKey(goalDeadline.trim());

        setSaving(true);
        setError(null);
        try {
            let bucketId = editing?.id;
            const tripPayload = isViagem && !tripLocked && tripId ? { tripId } : {};

            if (editing) {
                await updateCofrinhoBucket(editing.id, {
                    name: trimmed,
                    colorKey,
                    yieldMultiplier: yMult,
                    ...(tripLocked
                        ? {}
                        : isViagem
                          ? { kind: 'viagem', ...tripPayload }
                          : { kind })
                });
            } else {
                const created = await createCofrinhoBucket({
                    name: trimmed,
                    colorKey,
                    yieldMultiplier: yMult,
                    ...(isViagem ? { kind: 'viagem', ...tripPayload } : { kind: kind === 'viagem' ? 'objetivo' : kind })
                });
                bucketId = created.id;
            }

            if (bucketId && (effectiveTarget > 0 || deadline)) {
                const savedGoal = await upsertBucketGoal(
                    {
                        bucketId,
                        year: goalYear,
                        targetAmount: effectiveTarget,
                        targetDeadline: deadline,
                        goalId: getBucketGoalForYear(goals, bucketId, goalYear)?.id ?? null
                    },
                    goals
                );
                if (deadline && !bucketGoalHasDeadline(savedGoal)) {
                    throw new Error('O prazo não foi gravado. Reinicie o servidor (back) e tente de novo.');
                }
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
        <Dialog open={open} onClose={onClose} id="cofrinho-buckets-modal">
            <DialogPanel size="lg" className="cofrinho-bucket-dialog">
                <DialogForm onSubmit={(e) => void onSubmit(e)} className="cofrinho-bucket-form cofrinho-bucket-form--modern">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <div className="cofrinho-bucket-dialog__header-actions">
                            {editing && !tripLocked ? (
                                <button
                                    type="button"
                                    className="ui-dialog__close cofrinho-bucket-dialog__delete"
                                    disabled={saving}
                                    title="Excluir caixinha"
                                    aria-label="Excluir caixinha"
                                    onClick={() => void onDelete()}
                                >
                                    <MaterialIcon name="delete_outline" variant="app" />
                                </button>
                            ) : null}
                            <DialogCloseButton />
                        </div>
                    </DialogHeader>
                    <DialogBody className="cofrinho-bucket-dialog__body">
                        {error ? (
                            <p className="form-message ui-form-alert" role="alert">
                                {error}
                            </p>
                        ) : null}

                        <section className="cofrinho-bucket-form__section" aria-label="Identificação">
                            <div className="cofrinho-bucket-form__row cofrinho-bucket-form__row--name-goal">
                                <FormField id="cofrinho-bucket-name" label="Nome">
                                    <FormInput
                                        id="cofrinho-bucket-name"
                                        maxLength={120}
                                        required
                                        placeholder={isViagem ? 'Usa o título da viagem' : 'Ex.: Reserva Europa 2027'}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={tripLocked || (isViagem && !editing && Boolean(tripId))}
                                    />
                                </FormField>
                                <FormField id="cofrinho-bucket-goal-target" label={`Meta ${goalYear}`}>
                                    <CofrinhoBucketGoalInput
                                        id="cofrinho-bucket-goal-target"
                                        value={goalTarget}
                                        onChange={setGoalTarget}
                                    />
                                </FormField>
                                <FormField id="cofrinho-bucket-goal-deadline" label="Prazo">
                                    <DatePicker
                                        id="cofrinho-bucket-goal-deadline"
                                        value={goalDeadline}
                                        onChange={setGoalDeadline}
                                        placeholder="Opcional"
                                        className="cofrinho-bucket-form__date-picker"
                                        aria-label="Prazo para bater a meta"
                                    />
                                </FormField>
                            </div>

                            <FormField id="cofrinho-bucket-kind-field" label="Tipo">
                                <CofrinhoBucketTypePicker
                                    value={kind}
                                    onChange={onKindChange}
                                    disabled={tripLocked}
                                />
                            </FormField>

                            {isViagem ? (
                                <FormField id="cofrinho-bucket-trip" label="Viagem vinculada">
                                    {tripLocked && linkedTripId ? (
                                        <div className="cofrinho-bucket-form__trip-chip">
                                            <MaterialIcon name="flight" variant="app" opticalSize={18} aria-hidden />
                                            <span className="cofrinho-bucket-form__trip-chip-label">{linkedTripTitle}</span>
                                            <Link
                                                to={`/viagens/${linkedTripId}`}
                                                className="cofrinho-bucket-form__trip-link"
                                                onClick={onClose}
                                            >
                                                Abrir ficha
                                                <MaterialIcon name="open_in_new" variant="app" opticalSize={14} aria-hidden />
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <FormSelect
                                                id="cofrinho-bucket-trip"
                                                value={tripId}
                                                disabled={tripsLoading}
                                                required
                                                onChange={(e) => setTripId(e.target.value)}
                                            >
                                                <option value="">
                                                    {tripsLoading
                                                        ? 'Carregando viagens…'
                                                        : selectableTrips.length === 0
                                                          ? 'Nenhuma viagem disponível'
                                                          : 'Selecione a viagem'}
                                                </option>
                                                {selectableTrips.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.title}
                                                    </option>
                                                ))}
                                                {tripId && !trips.some((t) => t.id === tripId) ? (
                                                    <option value={tripId}>{linkedTripTitle}</option>
                                                ) : null}
                                            </FormSelect>
                                            <span className="ui-form-field__hint">
                                                {tripsLoadError
                                                    ? tripsLoadError
                                                    : !tripsLoading && selectableTrips.length === 0
                                                      ? 'Crie uma viagem em Viagens ou vincule uma que ainda não tenha caixinha sua.'
                                                      : 'Uma caixinha por viagem — aparece em «Viagens» no painel.'}
                                            </span>
                                        </>
                                    )}
                                </FormField>
                            ) : null}
                        </section>

                        <section className="cofrinho-bucket-form__section" aria-label="Aparência">
                            <FormField id="cofrinho-bucket-color" label="Cor no gráfico e extrato">
                                <CofrinhoBucketColorSwatches
                                    value={colorKey}
                                    layout="form"
                                    onChange={setColorKey}
                                />
                            </FormField>
                        </section>
                    </DialogBody>
                    <DialogFooter>
                        <div className="cofrinho-bucket-dialog__footer-actions">
                            <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? 'Guardando…' : editing ? 'Guardar' : 'Criar caixinha'}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogForm>
            </DialogPanel>
        </Dialog>
    );
}
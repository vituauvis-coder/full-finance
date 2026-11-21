import { type FormEvent, useEffect, useState } from 'react';
import { ModalShell } from '../../../../components/finance/ModalShell';
import { FormField, FormInput, FormSelect } from '../../../../components/ui/form';
import { formatBRL } from '../../../../lib/format';
import { createCofrinhoApplication, fetchPoolAvailable } from '../../api/cofrinhos';
import type { CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { yearMonthToReferenceMonth } from '../../domain/cofrinhoPeriod';

type Props = {
    open: boolean;
    onClose: () => void;
    buckets: CofrinhoBucket[];
    yearMonth: string;
    currency: string;
    preselectedBucketId?: string | null;
    onSaved: () => Promise<void>;
};

export function CofrinhoApplicationModal({
    open,
    onClose,
    buckets,
    yearMonth,
    currency,
    preselectedBucketId,
    onSaved
}: Props) {
    const [bucketId, setBucketId] = useState('');
    const [amount, setAmount] = useState('');
    const [poolMax, setPoolMax] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setAmount('');
        setBucketId(preselectedBucketId ?? buckets[0]?.id ?? '');
        void fetchPoolAvailable(yearMonth)
            .then(setPoolMax)
            .catch(() => setPoolMax(0));
    }, [buckets, open, preselectedBucketId, yearMonth]);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const value = parseFloat(amount);
        if (!bucketId || !Number.isFinite(value) || value <= 0) {
            setError('Informe caixinha e valor válido');
            return;
        }
        if (value > poolMax + 0.001) {
            setError(`Valor maior que o saldo disponível (${formatBRL(poolMax, currency)}).`);
            return;
        }
        const ref = yearMonthToReferenceMonth(yearMonth);
        if (!ref) {
            setError('Mês de referência inválido');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await createCofrinhoApplication({ bucketId, amount: value, referenceMonth: ref });
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível alocar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ModalShell open={open} title="Distribuir aporte" onClose={onClose} id="cofrinho-application-modal">
            <form className="cofrinho-allocation-form" onSubmit={(e) => void onSubmit(e)}>
                {error ? (
                    <p className="form-message" role="alert">
                        {error}
                    </p>
                ) : null}
                <p className="cofrinho-allocation-form__slider-meta">
                    Disponível no pool: <strong>{formatBRL(poolMax, currency)}</strong>
                </p>
                <FormField id="cofrinho-application-bucket" label="Aporte em qual cofrinho?">
                    <FormSelect
                        id="cofrinho-application-bucket"
                        value={bucketId}
                        required
                        onChange={(e) => setBucketId(e.target.value)}
                    >
                        <option value="">Selecione</option>
                        {buckets.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </FormSelect>
                </FormField>
                <FormField id="cofrinho-application-amount" label="Valor (R$)">
                    <FormInput
                        id="cofrinho-application-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0,00"
                    />
                </FormField>
                <footer className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving || buckets.length === 0}>
                        {saving ? 'A alocar…' : 'Confirmar aporte'}
                    </button>
                </footer>
            </form>
        </ModalShell>
    );
}
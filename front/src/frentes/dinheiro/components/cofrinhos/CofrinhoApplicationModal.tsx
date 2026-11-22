import { type FormEvent, useEffect, useState } from 'react';
import { ModalShell } from '../../../../components/finance/ModalShell';
import { FormField, FormInput, FormSelect } from '../../../../components/ui/form';
import { formatBRL } from '../../../../lib/format';
import { createCofrinhoApplication, fetchPoolAvailable } from '../../api/cofrinhos';
import type { CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { groupCofrinhoBucketsForDisplay } from '../../domain/cofrinhoBucketGroups';
import { cofrinhoKindMeta } from '../../domain/cofrinhoBucketTypes';
import { yearMonthToReferenceMonth } from '../../domain/cofrinhoPeriod';
import type { CofrinhoPoolPendingMonth } from '../../domain/cofrinhoPending';
import type { Account } from '../../../../lib/types/finance';

type Props = {
    open: boolean;
    onClose: () => void;
    buckets: CofrinhoBucket[];
    paymentAccounts: Account[];
    /** Mês civil do pool (data da saída «Pool», não o mês da toolbar). */
    yearMonth: string;
    poolMonths?: CofrinhoPoolPendingMonth[];
    currency: string;
    preselectedBucketId?: string | null;
    onSaved: () => Promise<void>;
};

export function CofrinhoApplicationModal({
    open,
    onClose,
    buckets,
    yearMonth,
    poolMonths = [],
    currency,
    paymentAccounts,
    preselectedBucketId,
    onSaved
}: Props) {
    const [bucketId, setBucketId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [poolYearMonth, setPoolYearMonth] = useState(yearMonth);
    const [poolMax, setPoolMax] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const poolChoices =
        poolMonths.length > 0
            ? poolMonths
            : [{ yearMonth: yearMonth, label: yearMonth, amount: poolMax }];

    const selectedPoolMonth = poolChoices.find((p) => p.yearMonth === poolYearMonth);
    const effectivePoolMax =
        poolMax > 0.001 ? poolMax : Math.max(0, Number(selectedPoolMonth?.amount) || 0);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setAmount('');
        setPoolYearMonth(yearMonth);
        setBucketId(preselectedBucketId ?? buckets[0]?.id ?? '');
        setAccountId((prev) => {
            if (prev && paymentAccounts.some((a) => a.id === prev)) return prev;
            return paymentAccounts[0]?.id ?? '';
        });
    }, [buckets, open, paymentAccounts, preselectedBucketId, yearMonth]);

    useEffect(() => {
        if (!open || !poolYearMonth) return;
        void fetchPoolAvailable(poolYearMonth)
            .then(setPoolMax)
            .catch(() => setPoolMax(0));
    }, [open, poolYearMonth]);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const value = parseFloat(amount);
        if (!bucketId || !Number.isFinite(value) || value <= 0) {
            setError('Informe caixinha e valor válido');
            return;
        }
        if (value > effectivePoolMax + 0.001) {
            setError(`Valor maior que o saldo disponível (${formatBRL(effectivePoolMax, currency)}).`);
            return;
        }
        const ref = yearMonthToReferenceMonth(poolYearMonth);
        if (!ref) {
            setError('Mês de referência inválido');
            return;
        }
        if (!accountId) {
            setError('Selecione a conta de onde saiu o dinheiro');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await createCofrinhoApplication({
                bucketId,
                amount: value,
                referenceMonth: ref,
                accountId
            });
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível alocar');
        } finally {
            setSaving(false);
        }
    }

    const bucketSections = groupCofrinhoBucketsForDisplay(buckets);

    return (
        <ModalShell open={open} title="Aportar no cofrinho" onClose={onClose} id="cofrinho-application-modal">
            <form className="cofrinho-allocation-form cofrinho-allocation-form--modern" onSubmit={(e) => void onSubmit(e)}>
                {error ? (
                    <p className="form-message" role="alert">
                        {error}
                    </p>
                ) : null}
                <div className="cofrinho-allocation-form__pool">
                    {poolChoices.length > 1 ? (
                        <FormField id="cofrinho-pool-month" label="Mês do pool">
                            <FormSelect
                                id="cofrinho-pool-month"
                                value={poolYearMonth}
                                onChange={(e) => setPoolYearMonth(e.target.value)}
                            >
                                {poolChoices.map((p) => (
                                    <option key={p.yearMonth} value={p.yearMonth}>
                                        {p.label} · {formatBRL(p.amount, currency)}
                                    </option>
                                ))}
                            </FormSelect>
                        </FormField>
                    ) : (
                        <span className="cofrinho-allocation-form__pool-label">
                            Pool de {poolChoices[0]?.label ?? poolYearMonth}
                        </span>
                    )}
                    <strong className="cofrinho-allocation-form__pool-value">
                        {formatBRL(effectivePoolMax, currency)}
                    </strong>
                    {effectivePoolMax <= 0.001 && poolMonths.some((p) => p.amount > 0.001) ? (
                        <p className="cofrinho-allocation-form__pool-hint">
                            O saldo pendente está em outro mês civil — escolha o mês acima (igual à data da saída «Pool»).
                        </p>
                    ) : null}
                </div>
                <FormField id="cofrinho-application-bucket" label="Caixinha">
                    <FormSelect
                        id="cofrinho-application-bucket"
                        value={bucketId}
                        required
                        onChange={(e) => setBucketId(e.target.value)}
                    >
                        <option value="">Selecione…</option>
                        {bucketSections.map((section) => (
                            <optgroup key={section.id} label={section.title}>
                                {section.buckets.map((b) => {
                                    const kind = cofrinhoKindMeta(b);
                                    return (
                                        <option key={b.id} value={b.id}>
                                            {b.name} · {kind.shortLabel}
                                        </option>
                                    );
                                })}
                            </optgroup>
                        ))}
                    </FormSelect>
                </FormField>
                <FormField id="cofrinho-application-account" label="Conta / banco">
                    <FormSelect
                        id="cofrinho-application-account"
                        value={accountId}
                        required
                        onChange={(e) => setAccountId(e.target.value)}
                    >
                        <option value="">Selecione…</option>
                        {paymentAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </FormSelect>
                </FormField>
                {paymentAccounts.length === 0 ? (
                    <p className="cofrinho-allocation-form__pool-hint">
                        Cadastre uma conta corrente ou poupança na Carteira para vincular o aporte.
                    </p>
                ) : null}
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
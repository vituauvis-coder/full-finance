import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalShell } from '../../../../components/finance/ModalShell';
import { FormDatePicker, FormField, FormInput, FormMonthPicker, FormSelect, FormGrid } from '../../../../components/ui/form';
import type { Account } from '../../../../lib/types/finance';
import type { Movement } from '../../../../lib/types/finance';
import { updateCofrinhoApplication } from '../../api/cofrinhos';
import { updateExpense } from '../../api/movements';
import type { CofrinhoLedgerRow } from '../../domain/cofrinhoLedgerRows';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { EXPENSE_COFRINHO_CATEGORY } from '../../domain/cofrinhoConstants';
import { groupCofrinhoBucketsForDisplay } from '../../domain/cofrinhoBucketGroups';
import { ledgerEditDescription, ledgerEditReferenceYm } from '../../domain/cofrinhoLedgerEdit';
import { parseMoneyInput } from '../../domain/parseMoneyInput';
import { yearMonthToReferenceMonth } from '../../domain/cofrinhoPeriod';

type Props = {
    open: boolean;
    row: CofrinhoLedgerRow | null;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    paymentAccounts: Account[];
    onClose: () => void;
    onSaved: () => Promise<void>;
};

function formatAmountInput(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '';
    return String(value).replace('.', ',');
}

export function CofrinhoLedgerInflowEditModal({
    open,
    row,
    buckets,
    applications,
    expenses,
    paymentAccounts,
    onClose,
    onSaved
}: Props) {
    const editingRowRef = useRef<CofrinhoLedgerRow | null>(null);
    const [bucketId, setBucketId] = useState('');
    const [description, setDescription] = useState('');
    const [referenceYm, setReferenceYm] = useState('');
    const [recordDate, setRecordDate] = useState('');
    const [accountId, setAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bucketSections = useMemo(() => groupCofrinhoBucketsForDisplay(buckets), [buckets]);
    const editingRow = row;

    useEffect(() => {
        if (open && editingRow) editingRowRef.current = editingRow;
        if (!open) editingRowRef.current = null;
    }, [open, editingRow]);

    useEffect(() => {
        if (!open || !editingRow) return;
        setError(null);
        setBucketId(editingRow.bucketId);
        setDescription(ledgerEditDescription(editingRow, applications, expenses));
        setReferenceYm(ledgerEditReferenceYm(editingRow, applications));
        const record =
            editingRow.recordDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ??
            new Date().toISOString().slice(0, 10);
        setRecordDate(record);
        const defaultAccount =
            editingRow.accountId && paymentAccounts.some((a) => a.id === editingRow.accountId)
                ? editingRow.accountId
                : paymentAccounts[0]?.id ?? editingRow.accountId ?? '';
        setAccountId(defaultAccount);
        setAmount(formatAmountInput(editingRow.amount));
    }, [applications, editingRow, expenses, open, paymentAccounts]);

    const onSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            const edit = editingRowRef.current;
            if (!edit) {
                setError('Não foi possível identificar o aporte. Feche e abra de novo.');
                return;
            }
            if (!bucketId) {
                setError('Selecione a caixinha');
                return;
            }
            if (!accountId) {
                setError('Selecione a conta');
                return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
                setError('Data de registro inválida');
                return;
            }
            const parsedAmount = parseMoneyInput(amount);
            if (parsedAmount == null || parsedAmount <= 0) {
                setError('Informe um valor válido');
                return;
            }

            const bucket = buckets.find((b) => b.id === bucketId);
            const bucketName = bucket?.name?.trim() || 'Caixinha';
            const desc =
                description.trim() || (edit.applicationId ? 'Aporte (distribuição)' : 'Aporte direto');

            let referenceMonth: string | null = null;
            if (edit.applicationId) {
                if (!referenceYm || !/^\d{4}-\d{2}$/.test(referenceYm)) {
                    setError('Mês de referência inválido');
                    return;
                }
                referenceMonth = yearMonthToReferenceMonth(referenceYm);
                if (!referenceMonth) {
                    setError('Mês de referência inválido');
                    return;
                }
            }

            setSaving(true);
            setError(null);
            try {
                if (edit.applicationId) {
                    await updateCofrinhoApplication(String(edit.applicationId), {
                        bucketId,
                        amount: parsedAmount,
                        accountId,
                        recordDate,
                        referenceMonth: referenceMonth!,
                        description: desc
                    });
                } else if (edit.expenseId) {
                    const existing = expenses.find((x) => String(x.id) === edit.expenseId);
                    if (!existing) {
                        throw new Error('Saída vinculada não encontrada');
                    }
                    await updateExpense(edit.expenseId, {
                        description: desc,
                        amount: parsedAmount,
                        accountId,
                        category: String(existing.category ?? EXPENSE_COFRINHO_CATEGORY),
                        subcategory: bucketName,
                        date: recordDate,
                        isPaid: existing.isPaid !== false,
                        installmentCount: existing.installmentCount ?? 1,
                        isFixed: Boolean(existing.isFixed),
                        isCofrinho: true
                    });
                } else {
                    throw new Error('Este aporte não pode ser editado');
                }
                await onSaved();
                window.dispatchEvent(new Event('finance:data-changed'));
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Não foi possível salvar');
            } finally {
                setSaving(false);
            }
        },
        [
            accountId,
            amount,
            bucketId,
            buckets,
            description,
            expenses,
            onClose,
            onSaved,
            recordDate,
            referenceYm
        ]
    );

    if (!open || !editingRow) return null;

    return (
        <ModalShell open={open} title="Editar aporte" onClose={onClose} id="cofrinho-ledger-edit-modal" size="md">
            <form
                className="cofrinho-allocation-form cofrinho-allocation-form--modern cofrinho-ledger-edit"
                onSubmit={(e) => void onSubmit(e)}
            >
                {error ? (
                    <p className="form-message" role="alert">
                        {error}
                    </p>
                ) : null}

                <FormField id="cofrinho-ledger-edit-bucket" label="Caixinha">
                    <FormSelect
                        id="cofrinho-ledger-edit-bucket"
                        value={bucketId}
                        required
                        onChange={(e) => setBucketId(e.target.value)}
                    >
                        <option value="">Selecione…</option>
                        {bucketSections.map((section) => (
                            <optgroup key={section.id} label={section.title}>
                                {section.buckets.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </FormSelect>
                </FormField>

                <FormField id="cofrinho-ledger-edit-desc" label="Descrição">
                    <FormInput
                        id="cofrinho-ledger-edit-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descrição do aporte"
                    />
                </FormField>

                <FormGrid columns={2}>
                    {editingRow.applicationId ? (
                        <FormField id="cofrinho-ledger-edit-ref-month" label="Mês de referência">
                            <FormMonthPicker
                                id="cofrinho-ledger-edit-ref-month"
                                required
                                value={referenceYm}
                                onChange={setReferenceYm}
                                placeholder="Mês de referência"
                            />
                        </FormField>
                    ) : null}
                    <FormField id="cofrinho-ledger-edit-date" label="Data de registro">
                        <FormDatePicker
                            id="cofrinho-ledger-edit-date"
                            required
                            value={recordDate}
                            onChange={setRecordDate}
                            placeholder="Data do registro"
                        />
                    </FormField>
                    <FormField id="cofrinho-ledger-edit-amount" label="Valor (R$)">
                        <FormInput
                            id="cofrinho-ledger-edit-amount"
                            inputMode="decimal"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                        />
                    </FormField>
                    <FormField id="cofrinho-ledger-edit-account" label="Conta / banco">
                        <FormSelect
                            id="cofrinho-ledger-edit-account"
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
                </FormGrid>

                <footer className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={saving || paymentAccounts.length === 0 || buckets.length === 0}
                    >
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </footer>
            </form>
        </ModalShell>
    );
}
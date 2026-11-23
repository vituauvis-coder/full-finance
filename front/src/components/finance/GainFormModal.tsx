import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Account, Movement } from '../../lib/types/finance';
import { useCategories } from '../../hooks/useCategories';
import { sortedBankAccounts } from '../../lib/accounts';
import { ambiguousAccountNameKeys, accountSelectDisplayName } from '../../lib/accountSelectOptions';
import { DialogForm, DialogFrame } from '../ui/dialog';
import {
    FormActions,
    FormAlert,
    FormCheckbox,
    FormDatePicker,
    FormField,
    FormGrid,
    FormInput,
    FormSelect
} from '../ui/form';
import {
    createGain,
    movementFromFormDate,
    updateGain,
    type GainFormPayload
} from '../../frentes/dinheiro/api/movements';
import { defaultCivilYear, defaultMovementFormDate, defaultPeriod } from '../../lib/period';

type Props = {
    open: boolean;
    editing: Movement | null;
    accounts: Account[];
    onClose: () => void | Promise<void>;
    onSaved: () => void | Promise<void>;
    period?: string;
    civilYear?: number;
};

export function GainFormModal({
    open,
    editing,
    accounts,
    onClose,
    onSaved,
    period = defaultPeriod(),
    civilYear = defaultCivilYear()
}: Props) {
    const { categories } = useCategories('gain');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [isPaid, setIsPaid] = useState(true);
    const [recurring, setRecurring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setDescription(editing.description ?? '');
            setAmount(String(editing.amount ?? ''));
            setAccountId(editing.accountId ?? '');
            setCategory(editing.category ?? '');
            setSubcategory(editing.subcategory ?? '');
            setDate(movementFromFormDate(editing));
            setIsPaid(editing.isPaid !== false);
            setRecurring(false);
        } else {
            setDescription('');
            setAmount('');
            const banks = sortedBankAccounts(accounts);
            setAccountId(banks[0]?.id ?? '');
            setCategory('');
            setSubcategory('');
            setDate(defaultMovementFormDate(period, civilYear));
            setIsPaid(true);
            setRecurring(false);
        }
    }, [open, editing, accounts, period, civilYear]);

    const subs = categories.find((c) => c.name === category)?.subcategories ?? [];
    const bankOptions = useMemo(() => {
        const banks = sortedBankAccounts(accounts);
        const ambiguous = ambiguousAccountNameKeys(banks);
        return banks.map((a) => ({ id: a.id, label: accountSelectDisplayName(a, ambiguous) }));
    }, [accounts]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const payload: GainFormPayload = {
            description: description.trim(),
            amount: parseFloat(amount),
            accountId,
            category,
            subcategory: subcategory || null,
            date,
            isPaid,
            isRecurring: !editing && recurring
        };
        if (!payload.description || !payload.category || !payload.accountId) {
            setError('Preencha descrição, categoria e conta.');
            return;
        }
        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            setError('Valor inválido.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editing) await updateGain(editing.id, payload);
            else await createGain(payload);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <DialogFrame
            id="gain-modal"
            open={open}
            title={editing ? 'Editar entrada' : 'Nova entrada'}
            onClose={onClose}
            size="md"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                <FormGrid columns={2}>
                    <FormField id="gain-category-select" label="Categoria">
                        <FormSelect
                            id="gain-category-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            <option value="">Selecione…</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.name}>
                                    {c.name}
                                </option>
                            ))}
                        </FormSelect>
                    </FormField>
                    <FormField id="gain-subcategory-select" label="Subcategoria">
                        <FormSelect
                            id="gain-subcategory-select"
                            value={subcategory}
                            onChange={(e) => setSubcategory(e.target.value)}
                        >
                            <option value="">—</option>
                            {subs.map((s) => (
                                <option key={s.id} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </FormSelect>
                    </FormField>
                </FormGrid>
                <FormField id="gain-description" label="Descrição">
                    <FormInput
                        id="gain-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        autoComplete="off"
                    />
                </FormField>
                <FormGrid columns={2}>
                    <FormField id="gain-amount" label="Valor">
                        <FormInput
                            id="gain-amount"
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </FormField>
                    <FormField id="gain-account" label="Conta">
                        <FormSelect id="gain-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                            <option value="">Selecione…</option>
                            {bankOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.label}
                                </option>
                            ))}
                        </FormSelect>
                    </FormField>
                </FormGrid>
                <FormField id="gain-date" label="Data">
                    <FormDatePicker id="gain-date" value={date} onChange={setDate} required placeholder="Data da entrada" />
                </FormField>
                <div className="ui-form-checkboxes">
                    {!editing ? (
                        <FormCheckbox
                            id="gain-recurring"
                            label="Repetir até dezembro"
                            checked={recurring}
                            onChange={setRecurring}
                        />
                    ) : null}
                    <FormCheckbox
                        id="gain-is-received"
                        label="Já recebi na conta"
                        checked={isPaid}
                        onChange={setIsPaid}
                    />
                </div>
                <FormActions onCancel={onClose} busy={saving} />
            </DialogForm>
        </DialogFrame>
    );
}
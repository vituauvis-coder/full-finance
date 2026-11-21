import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Account, Movement } from '../../lib/types/finance';
import {
    buildPaymentMethodOptions,
    isCreditCardType,
    resolvePaymentMethod,
    sortedBankAccounts
} from '../../lib/accounts';
import { EXPENSE_LOAN_PAYMENT_VALUE, isLoanExpense } from '../../lib/loanExpense';
import { useCategories } from '../../hooks/useCategories';
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
    createExpense,
    movementFromFormDate,
    updateExpense,
    type ExpenseFormPayload
} from '../../frentes/dinheiro/api/movements';

type Props = {
    open: boolean;
    editing: Movement | null;
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function ExpenseFormModal({ open, editing, accounts, onClose, onSaved }: Props) {
    const { categories } = useCategories('expense');
    const [loanAccountId, setLoanAccountId] = useState('');

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const loanCategory = isLoanExpense({ category, subcategory });
    const paymentOptions = useMemo(
        () => buildPaymentMethodOptions(accounts, { includeLoan: loanCategory }),
        [accounts, loanCategory]
    );
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [isPaid, setIsPaid] = useState(false);
    const [installments, setInstallments] = useState('1');
    const [isFixed, setIsFixed] = useState(false);
    const [isCofrinho, setIsCofrinho] = useState(false);
    const [recurringMonthly, setRecurringMonthly] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const selectedAcc = accounts.find((a) => a.id === paymentMethodId);
    const showInstallments =
        (!editing && loanCategory) || (selectedAcc && isCreditCardType(selectedAcc.type) && !editing);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setDescription(editing.description ?? '');
            setAmount(String(editing.amount ?? ''));
            setPaymentMethodId(editing.accountId ?? '');
            setCategory(editing.category ?? '');
            setSubcategory(editing.subcategory ?? '');
            setDate(movementFromFormDate(editing));
            setIsPaid(editing.isPaid !== false);
            setInstallments(String(editing.installmentCount ?? 1));
            setIsFixed(
                editing.isFixed === true ||
                    editing.isFixed === 'true' ||
                    editing.isFixed === 1 ||
                    editing.isFixed === '1'
            );
            setIsCofrinho(!!editing.isCofrinho);
            setRecurringMonthly(false);
            setLoanAccountId(editing.accountId ?? '');
        } else {
            setDescription('');
            setAmount('');
            setPaymentMethodId(paymentOptions[0]?.value ?? '');
            setCategory('');
            setSubcategory('');
            setDate(new Date().toISOString().slice(0, 10));
            setIsPaid(false);
            setInstallments('1');
            setIsFixed(false);
            setIsCofrinho(false);
            setRecurringMonthly(false);
            setLoanAccountId('');
        }
    }, [open, editing, accounts, paymentOptions]);

    useEffect(() => {
        if (!open || editing) return;
        if (loanCategory) {
            setPaymentMethodId(EXPENSE_LOAN_PAYMENT_VALUE);
            if (!loanAccountId && sortedBankAccounts(accounts)[0]) {
                setLoanAccountId(sortedBankAccounts(accounts)[0].id);
            }
        }
    }, [loanCategory, open, editing, accounts, loanAccountId]);

    useEffect(() => {
        if (!open || editing) return;
        const resolved = resolvePaymentMethod(
            paymentMethodId,
            accounts,
            loanCategory ? loanAccountId : undefined
        );
        if (resolved) setIsPaid(resolved.isPaid);
    }, [paymentMethodId, accounts, open, editing, loanAccountId, loanCategory]);

    const subs = categories.find((c) => c.name === category)?.subcategories ?? [];

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const resolved = resolvePaymentMethod(
            paymentMethodId,
            accounts,
            loanCategory ? loanAccountId : undefined
        );
        const accountId = resolved?.accountId ?? paymentMethodId;
        if (loanCategory && paymentMethodId === EXPENSE_LOAN_PAYMENT_VALUE && !loanAccountId) {
            setError('Selecione a conta de débito do empréstimo.');
            return;
        }
        const n = parseInt(installments, 10);
        const payload: ExpenseFormPayload = {
            description: description.trim(),
            amount: parseFloat(amount),
            accountId,
            category,
            subcategory: subcategory || null,
            date,
            isPaid: editing ? isPaid : (resolved?.isPaid ?? isPaid),
            installmentCount: showInstallments && Number.isFinite(n) && n >= 1 ? n : 1,
            isFixed,
            isCofrinho,
            recurringMonthly: !editing && recurringMonthly ? true : undefined
        };
        if (!payload.description || !payload.category || !payload.accountId) {
            setError('Preencha descrição, categoria e forma de pagamento.');
            return;
        }
        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            setError('Valor inválido.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editing) await updateExpense(editing.id, payload);
            else await createExpense(payload);
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
            id="expense-modal"
            open={open}
            title={editing ? 'Editar saída' : 'Nova saída'}
            onClose={onClose}
            size="lg"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                <FormGrid columns={2}>
                    <FormField id="expense-category-select" label="Categoria">
                        <FormSelect
                            id="expense-category-select"
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
                    <FormField id="expense-subcategory-select" label="Subcategoria">
                        <FormSelect
                            id="expense-subcategory-select"
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
                <FormField id="expense-description" label="Descrição">
                    <FormInput
                        id="expense-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        autoComplete="off"
                    />
                </FormField>
                <FormGrid columns={2}>
                    <FormField id="expense-amount" label="Valor">
                        <FormInput
                            id="expense-amount"
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </FormField>
                    <FormField id="expense-date" label="Data">
                        <FormDatePicker id="expense-date" value={date} onChange={setDate} required placeholder="Data da saída" />
                    </FormField>
                </FormGrid>
                <FormField id="expense-payment-method" label="Forma de pagamento">
                    <FormSelect
                        id="expense-payment-method"
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                        required
                    >
                        <option value="">Selecione…</option>
                        {paymentOptions.filter((o) => o.group === 'pix').length > 0 ? (
                            <optgroup label="PIX">
                                {paymentOptions
                                    .filter((o) => o.group === 'pix')
                                    .map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                            </optgroup>
                        ) : null}
                        {paymentOptions.filter((o) => o.group === 'card').length > 0 ? (
                            <optgroup label="Cartões">
                                {paymentOptions
                                    .filter((o) => o.group === 'card')
                                    .map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                            </optgroup>
                        ) : null}
                    </FormSelect>
                </FormField>
                {loanCategory && paymentMethodId === EXPENSE_LOAN_PAYMENT_VALUE ? (
                    <FormField id="expense-loan-account" label="Conta de débito (empréstimo)">
                        <FormSelect
                            id="expense-loan-account"
                            value={loanAccountId}
                            onChange={(e) => setLoanAccountId(e.target.value)}
                            required
                        >
                            <option value="">Selecione…</option>
                            {sortedBankAccounts(accounts).map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </FormSelect>
                    </FormField>
                ) : null}
                {showInstallments ? (
                    <FormField id="expense-installments" label="Parcelas">
                        <FormInput
                            id="expense-installments"
                            type="number"
                            min={1}
                            max={99}
                            value={installments}
                            onChange={(e) => setInstallments(e.target.value)}
                        />
                    </FormField>
                ) : null}
                <div className="ui-form-checkboxes">
                    {!editing ? (
                        <FormCheckbox
                            id="expense-recurring"
                            label="Repetir até dezembro"
                            checked={recurringMonthly}
                            onChange={setRecurringMonthly}
                        />
                    ) : null}
                    <FormCheckbox id="expense-is-fixed" label="Essencial (fixo)" checked={isFixed} onChange={setIsFixed} />
                    <FormCheckbox
                        id="expense-is-cofrinho"
                        label="Aplicar em cofrinho"
                        checked={isCofrinho}
                        onChange={setIsCofrinho}
                    />
                    {editing ? (
                        <FormCheckbox id="expense-is-paid" label="Pago" checked={isPaid} onChange={setIsPaid} />
                    ) : null}
                </div>
                {!editing ? (
                    <p className="ui-form-hint-block">
                        Cartão de crédito entra como pendente; PIX/conta como pago (editável após salvar).
                    </p>
                ) : null}
                <FormActions onCancel={onClose} busy={saving} />
            </DialogForm>
        </DialogFrame>
    );
}
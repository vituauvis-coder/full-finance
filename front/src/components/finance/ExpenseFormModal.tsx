import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Account, ExpenseSplitSeed, Movement } from '../../lib/types/finance';
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
import { normalizeSplitScope } from '@motor/dinheiro/split-net.js';
import {
    normalizePaidPeriodKeysToDues,
    parseCashOutConfirmedPeriods
} from '@motor/dinheiro/cash-out-periods.js';
import {
    ExpenseInstallmentPreview,
    resolveInstallmentDueDates
} from './ExpenseInstallmentPreview';

type Props = {
    open: boolean;
    editing: Movement | null;
    accounts: Account[];
    splitSeed?: ExpenseSplitSeed | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

function paidKeysFromExpense(expense: Movement | null | undefined): string[] {
    if (!expense) return [];
    return [...parseCashOutConfirmedPeriods(expense)];
}

export function ExpenseFormModal({
    open,
    editing,
    accounts,
    splitSeed = null,
    onClose,
    onSaved
}: Props) {
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
    const [paidPeriodKeys, setPaidPeriodKeys] = useState<string[]>([]);
    const [isFixed, setIsFixed] = useState(false);
    const [isCofrinho, setIsCofrinho] = useState(false);
    const [recurringMonthly, setRecurringMonthly] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const fromRateio = Boolean(splitSeed?.splitRequestId) && !editing;
    const selectedAcc = accounts.find((a) => a.id === paymentMethodId);
    const loanDebitAcc = accounts.find((a) => a.id === loanAccountId);
    const installmentAccount: Account | undefined =
        loanCategory && paymentMethodId === EXPENSE_LOAN_PAYMENT_VALUE
            ? loanDebitAcc
            : selectedAcc;

    const nInst = Math.min(99, Math.max(1, parseInt(installments, 10) || 1));
    const paymentIsCredit = !!(selectedAcc && isCreditCardType(selectedAcc.type));
    const showInstallmentsField =
        paymentIsCredit ||
        loanCategory ||
        (fromRateio && nInst >= 2) ||
        (editing && nInst >= 2);
    const showInstallmentPreview =
        nInst >= 2 && (paymentIsCredit || loanCategory || (fromRateio && nInst >= 2));

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
            setPaidPeriodKeys(paidKeysFromExpense(editing));
            setIsFixed(
                editing.isFixed === true ||
                    editing.isFixed === 'true' ||
                    editing.isFixed === 1 ||
                    editing.isFixed === '1'
            );
            setIsCofrinho(!!editing.isCofrinho);
            setRecurringMonthly(false);
            setLoanAccountId(editing.accountId ?? '');
            return;
        }

        if (splitSeed) {
            const src = splitSeed.sourceExpense;
            setDescription(String(src?.description ?? '').trim());
            setAmount(String(splitSeed.splitAmount));
            setPaymentMethodId(paymentOptions[0]?.value ?? '');
            setCategory(String(src?.category ?? '').trim());
            setSubcategory(String(src?.subcategory ?? '').trim());
            setDate(new Date().toISOString().slice(0, 10));
            setIsPaid(false);
            const scope = normalizeSplitScope(splitSeed.splitScope || 'FULL_EXPENSE');
            const srcInst =
                scope === 'FULL_EXPENSE' &&
                splitSeed.sourceInstallmentCount &&
                splitSeed.sourceInstallmentCount >= 2
                    ? Math.min(99, splitSeed.sourceInstallmentCount)
                    : 1;
            setInstallments(String(srcInst));
            setPaidPeriodKeys([]);
            setIsFixed(Boolean(src?.isFixed));
            setIsCofrinho(!!src?.isCofrinho);
            setRecurringMonthly(Boolean(src?.recurrenceGroupId));
            setLoanAccountId('');
            return;
        }

        setDescription('');
        setAmount('');
        setPaymentMethodId(paymentOptions[0]?.value ?? '');
        setCategory('');
        setSubcategory('');
        setDate(new Date().toISOString().slice(0, 10));
        setIsPaid(false);
        setInstallments('1');
        setPaidPeriodKeys([]);
        setIsFixed(false);
        setIsCofrinho(false);
        setRecurringMonthly(false);
        setLoanAccountId('');
    }, [open, editing, splitSeed, accounts, paymentOptions]);

    useEffect(() => {
        if (!open || editing || fromRateio) return;
        if (loanCategory) {
            setPaymentMethodId(EXPENSE_LOAN_PAYMENT_VALUE);
            if (!loanAccountId && sortedBankAccounts(accounts)[0]) {
                setLoanAccountId(sortedBankAccounts(accounts)[0].id);
            }
        }
    }, [loanCategory, open, editing, accounts, loanAccountId, fromRateio]);

    useEffect(() => {
        if (!open || editing) return;
        const resolved = resolvePaymentMethod(
            paymentMethodId,
            accounts,
            loanCategory ? loanAccountId : undefined
        );
        if (resolved) setIsPaid(resolved.isPaid);
    }, [paymentMethodId, accounts, open, editing, loanAccountId, loanCategory]);

    // Normaliza chaves (YYYY-MM ou dia) para o vencimento canónico de cada parcela.
    useEffect(() => {
        if (!open || !showInstallmentPreview) return;
        const dues = resolveInstallmentDueDates(
            date,
            nInst,
            installmentAccount,
            loanCategory
        );
        if (dues.length < 2) return;
        setPaidPeriodKeys((prev) => {
            const next = normalizePaidPeriodKeysToDues(prev, dues);
            if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev;
            return next;
        });
    }, [open, showInstallmentPreview, date, nInst, installmentAccount, loanCategory]);

    const subs = categories.find((c) => c.name === category)?.subcategories ?? [];
    const title = editing ? 'Editar saída' : fromRateio ? 'Confirmar sua parte do rateio' : 'Nova saída';

    function togglePaidPeriod(periodKey: string) {
        setPaidPeriodKeys((prev) => {
            const monthKey = periodKey.length >= 7 ? periodKey.slice(0, 7) : periodKey;
            const has =
                prev.includes(periodKey) ||
                prev.includes(monthKey) ||
                prev.some((k) => k.startsWith(`${monthKey}-`));
            if (has) {
                return prev.filter(
                    (k) => k !== periodKey && k !== monthKey && !k.startsWith(`${monthKey}-`)
                );
            }
            return [...prev, periodKey];
        });
    }

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
        const useInstallments =
            fromRateio && Number.isFinite(n) && n >= 2
                ? n
                : showInstallmentsField && Number.isFinite(n) && n >= 1
                  ? n
                  : 1;
        const payload: ExpenseFormPayload = {
            description: description.trim(),
            amount: parseFloat(amount),
            accountId,
            category,
            subcategory: subcategory || null,
            date,
            isPaid: editing ? isPaid : (resolved?.isPaid ?? isPaid),
            installmentCount: useInstallments,
            isFixed,
            isCofrinho: fromRateio ? !!splitSeed?.sourceExpense?.isCofrinho || isCofrinho : isCofrinho,
            recurringMonthly: !editing && !fromRateio && recurringMonthly ? true : undefined,
            ...(fromRateio && splitSeed?.splitRequestId
                ? { splitRequestId: splitSeed.splitRequestId }
                : {})
        };
        if (useInstallments >= 2) {
            payload.cashOutConfirmedPeriods =
                paidPeriodKeys.length > 0 ? JSON.stringify(paidPeriodKeys) : null;
        }
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
        <DialogFrame id="expense-modal" open={open} title={title} onClose={onClose} size="lg">
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                {fromRateio ? (
                    <p className="ui-form-hint-block">
                        Preencha e salve sua saída para concluir o aceite e gerar o estorno ao
                        solicitante.
                    </p>
                ) : null}
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
                            readOnly={fromRateio}
                            className={fromRateio ? 'input-readonly-locked' : undefined}
                        />
                    </FormField>
                    <FormField id="expense-date" label="Data">
                        <FormDatePicker
                            id="expense-date"
                            value={date}
                            onChange={setDate}
                            required
                            placeholder="Data da saída"
                            disabled={fromRateio}
                        />
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
                <div className="ui-form-checkboxes ui-form-checkboxes--row">
                    <FormCheckbox
                        id="expense-is-fixed"
                        label="Essencial (fixo)"
                        checked={isFixed}
                        onChange={setIsFixed}
                    />
                    {!fromRateio ? (
                        <FormCheckbox
                            id="expense-is-cofrinho"
                            label="Aplicar em cofrinho"
                            checked={isCofrinho}
                            onChange={setIsCofrinho}
                        />
                    ) : null}
                    {editing ? (
                        <FormCheckbox
                            id="expense-is-paid"
                            label="Pago"
                            checked={isPaid}
                            onChange={setIsPaid}
                        />
                    ) : !fromRateio ? (
                        <FormCheckbox
                            id="expense-recurring"
                            label="Repetir até dezembro"
                            checked={recurringMonthly}
                            onChange={setRecurringMonthly}
                        />
                    ) : null}
                </div>
                {showInstallmentsField ? (
                    <FormField
                        id="expense-installments"
                        label={
                            paymentIsCredit
                                ? 'Parcelas no cartão de crédito'
                                : loanCategory
                                  ? 'Parcelas do empréstimo'
                                  : 'Parcelas'
                        }
                    >
                        <FormInput
                            id="expense-installments"
                            type="number"
                            min={1}
                            max={99}
                            value={installments}
                            onChange={(e) => setInstallments(e.target.value)}
                            readOnly={fromRateio}
                            className={fromRateio ? 'input-readonly-locked' : undefined}
                        />
                    </FormField>
                ) : null}
                {showInstallmentPreview ? (
                    <ExpenseInstallmentPreview
                        date={date}
                        installmentCount={nInst}
                        amount={parseFloat(amount) || 0}
                        account={installmentAccount}
                        loan={loanCategory}
                        paidKeys={paidPeriodKeys}
                        onTogglePeriod={togglePaidPeriod}
                    />
                ) : null}
                {!editing && !fromRateio ? (
                    <p className="ui-form-hint-block">
                        Cartão de crédito entra como pendente; PIX/conta como pago (editável após
                        salvar).
                    </p>
                ) : null}
                <FormActions
                    onCancel={onClose}
                    busy={saving}
                    submitLabel={fromRateio ? 'Aceitar e lançar' : 'Salvar'}
                />
            </DialogForm>
        </DialogFrame>
    );
}

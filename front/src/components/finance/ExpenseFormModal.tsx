import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Account, ExpenseSplitSeed, Movement } from '../../lib/types/finance';
import { fetchTripsList } from '../../frentes/viagens/api/trips';
import { EXPENSE_COFRINHO_CATEGORY } from '../../frentes/dinheiro/domain/cofrinhoConstants';
import { VIAGENS_EXPENSE_CATEGORY } from '../../frentes/dinheiro/domain/cofrinhoMovementLedger';
import { MaterialIcon } from '../icons/MaterialIcon';
import { ExpenseFormPaymentPicker } from './ExpenseFormPaymentPicker';
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
    const [trips, setTrips] = useState<{ id: string; title: string }[]>([]);
    const [tripId, setTripId] = useState('');
    const [paidFromCofrinho, setPaidFromCofrinho] = useState(false);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const fromRateio = Boolean(splitSeed?.splitRequestId) && !editing;
    const loanCategory = isLoanExpense({ category, subcategory });
    const linksTrip =
        !fromRateio &&
        (category === VIAGENS_EXPENSE_CATEGORY || category === EXPENSE_COFRINHO_CATEGORY);
    const tripTitleById = useMemo(() => new Map(trips.map((t) => [t.id, t.title])), [trips]);
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
            setTripId(String(editing.tripId ?? '').trim());
            setPaidFromCofrinho(
                editing.paidFromCofrinho === true ||
                    editing.paid_from_cofrinho === true ||
                    editing.paidFromCofrinho === 'true'
            );
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
        setTripId('');
        setPaidFromCofrinho(false);
        setRecurringMonthly(false);
        setLoanAccountId('');
    }, [open, editing, splitSeed, accounts, paymentOptions]);

    useEffect(() => {
        if (!open || fromRateio) return;
        let cancelled = false;
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
            .catch(() => {
                if (!cancelled) setTrips([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open, fromRateio]);

    useEffect(() => {
        if (!open || !tripId) return;
        const title = tripTitleById.get(tripId);
        if (title && linksTrip) setSubcategory(title);
        if (category === EXPENSE_COFRINHO_CATEGORY) setIsCofrinho(true);
    }, [tripId, tripTitleById, linksTrip, category, open]);

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
        // No rateio o default é pendente: PIX não deve forçar “pago” no aceite.
        if (!open || editing || fromRateio) return;
        const resolved = resolvePaymentMethod(
            paymentMethodId,
            accounts,
            loanCategory ? loanAccountId : undefined
        );
        if (resolved) setIsPaid(resolved.isPaid);
    }, [paymentMethodId, accounts, open, editing, loanAccountId, loanCategory, fromRateio]);

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
        const cofrinhoFlag =
            category === EXPENSE_COFRINHO_CATEGORY
                ? true
                : fromRateio
                  ? !!splitSeed?.sourceExpense?.isCofrinho || isCofrinho
                  : isCofrinho;
        const payload: ExpenseFormPayload = {
            description: description.trim(),
            amount: parseFloat(amount),
            accountId,
            category,
            subcategory: subcategory || null,
            date,
            isPaid: editing || fromRateio ? isPaid : (resolved?.isPaid ?? isPaid),
            installmentCount: useInstallments,
            isFixed,
            isCofrinho: cofrinhoFlag,
            recurringMonthly: !editing && !fromRateio && recurringMonthly ? true : undefined,
            ...(tripId ? { tripId } : {}),
            ...(category === VIAGENS_EXPENSE_CATEGORY && paidFromCofrinho ? { paidFromCofrinho: true } : {}),
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
        <DialogFrame
            id="expense-modal"
            open={open}
            title={title}
            onClose={onClose}
            size="md"
            panelClassName="expense-form-modal__panel"
        >
            <DialogForm className="ui-form expense-form-modal" onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                {fromRateio ? (
                    <p className="expense-form-modal__rateio-hint">
                        Preencha e salve sua saída para concluir o aceite. O estorno ao solicitante
                        só é gerado quando você marcar sua parte como paga.
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

                {linksTrip ? (
                    <FormField id="expense-trip-select" label="Viagem">
                        <FormSelect
                            id="expense-trip-select"
                            value={tripId}
                            onChange={(e) => {
                                const id = e.target.value;
                                setTripId(id);
                                if (!id) return;
                                const title = tripTitleById.get(id);
                                if (title) setSubcategory(title);
                            }}
                        >
                            <option value="">Sem vínculo com viagem</option>
                            {trips.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.title}
                                </option>
                            ))}
                            {tripId && !trips.some((t) => t.id === tripId) ? (
                                <option value={tripId}>Viagem (legado)</option>
                            ) : null}
                        </FormSelect>
                        <p className="expense-form-modal__hint viagens-muted">
                            A subcategoria vira o nome da viagem no extrato.
                        </p>
                    </FormField>
                ) : null}

                <FormGrid columns={2} className="expense-form-modal__desc-date">
                    <FormField id="expense-description" label="Descrição">
                        <FormInput
                            id="expense-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            autoComplete="off"
                            placeholder="Ex.: Mercado, aluguel…"
                        />
                    </FormField>
                    <FormField id="expense-date" label="Data">
                        <FormDatePicker
                            id="expense-date"
                            value={date}
                            onChange={setDate}
                            required
                            placeholder="Data"
                            disabled={fromRateio}
                        />
                    </FormField>
                </FormGrid>

                <FormGrid columns={2}>
                    <FormField id="expense-amount" label="Valor (R$)">
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
                            placeholder="0,00"
                        />
                    </FormField>
                    <FormField id="expense-payment-wrap" label="Forma de pagamento">
                        <ExpenseFormPaymentPicker
                            paymentMethodId={paymentMethodId}
                            onChange={setPaymentMethodId}
                            paymentOptions={paymentOptions}
                            loanMode={loanCategory && paymentMethodId === EXPENSE_LOAN_PAYMENT_VALUE}
                        />
                    </FormField>
                </FormGrid>

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

                {showInstallmentsField ? (
                    <FormField
                        id="expense-installments"
                        label={
                            paymentIsCredit
                                ? 'Parcelas no cartão'
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

                <FormField id="expense-options" label="Opções">
                    <div className="expense-form-modal__chips">
                        <button
                            type="button"
                            className={`expense-form-modal__chip${isFixed ? ' is-on' : ''}`}
                            aria-pressed={isFixed}
                            onClick={() => setIsFixed((v) => !v)}
                        >
                            <MaterialIcon name="push_pin" variant="app" opticalSize={17} aria-hidden />
                            Essencial
                        </button>
                        {!fromRateio && category !== EXPENSE_COFRINHO_CATEGORY ? (
                            <button
                                type="button"
                                className={`expense-form-modal__chip${isCofrinho ? ' is-on' : ''}`}
                                aria-pressed={isCofrinho}
                                onClick={() => setIsCofrinho((v) => !v)}
                            >
                                <MaterialIcon name="savings" variant="app" opticalSize={17} aria-hidden />
                                Cofrinho
                            </button>
                        ) : null}
                        {category === VIAGENS_EXPENSE_CATEGORY && tripId ? (
                            <button
                                type="button"
                                className={`expense-form-modal__chip${paidFromCofrinho ? ' is-on' : ''}`}
                                aria-pressed={paidFromCofrinho}
                                onClick={() => setPaidFromCofrinho((v) => !v)}
                            >
                                <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={17} aria-hidden />
                                Pago do cofrinho
                            </button>
                        ) : null}
                        {editing || fromRateio ? (
                            <button
                                type="button"
                                className={`expense-form-modal__chip${isPaid ? ' is-on' : ''}`}
                                aria-pressed={isPaid}
                                onClick={() => setIsPaid((v) => !v)}
                            >
                                <MaterialIcon name="check_circle" variant="app" opticalSize={17} aria-hidden />
                                Pago
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={`expense-form-modal__chip${recurringMonthly ? ' is-on' : ''}`}
                                aria-pressed={recurringMonthly}
                                onClick={() => setRecurringMonthly((v) => !v)}
                            >
                                <MaterialIcon name="event_repeat" variant="app" opticalSize={17} aria-hidden />
                                Repetir ano
                            </button>
                        )}
                    </div>
                </FormField>

                <FormActions
                    onCancel={onClose}
                    busy={saving}
                    submitLabel={fromRateio ? 'Aceitar e lançar' : 'Salvar'}
                />
            </DialogForm>
        </DialogFrame>
    );
}

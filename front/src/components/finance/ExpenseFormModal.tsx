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
import { ModalShell } from './ModalShell';
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

    async function onSubmit(e: FormEvent) {
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
        <ModalShell id="expense-modal" open={open} title={editing ? 'Editar saída' : 'Nova saída'} onClose={onClose}>
            <form className="modal-body" onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {error ? <p role="alert">{error}</p> : null}
                <div className="form-group">
                    <label htmlFor="expense-category-select">Categoria</label>
                    <select id="expense-category-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
                        <option value="">Selecione…</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="expense-subcategory-select">Subcategoria</label>
                    <select id="expense-subcategory-select" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                        <option value="">—</option>
                        {subs.map((s) => (
                            <option key={s.id} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="expense-description">Descrição</label>
                    <input id="expense-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="expense-amount">Valor</label>
                    <input id="expense-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="expense-payment-method">Forma de pagamento</label>
                    <select
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
                    </select>
                </div>
                {loanCategory && paymentMethodId === EXPENSE_LOAN_PAYMENT_VALUE ? (
                    <div className="form-group">
                        <label htmlFor="expense-loan-account">Conta de débito (empréstimo)</label>
                        <select
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
                        </select>
                    </div>
                ) : null}
                <div className="form-group">
                    <label htmlFor="expense-date">Data</label>
                    <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                {showInstallments ? (
                    <div className="form-group" id="expense-installments-row">
                        <label htmlFor="expense-installments">Parcelas</label>
                        <input
                            id="expense-installments"
                            type="number"
                            min={1}
                            max={99}
                            value={installments}
                            onChange={(e) => setInstallments(e.target.value)}
                        />
                    </div>
                ) : null}
                {!editing ? (
                    <div className="form-group form-group--checkbox">
                        <label>
                            <input type="checkbox" checked={recurringMonthly} onChange={(e) => setRecurringMonthly(e.target.checked)} /> Repetir até dezembro
                        </label>
                    </div>
                ) : null}
                <div className="form-group form-group--checkbox">
                    <label>
                        <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} /> Essencial (fixo)
                    </label>
                </div>
                <div className="form-group form-group--checkbox">
                    <label>
                        <input type="checkbox" checked={isCofrinho} onChange={(e) => setIsCofrinho(e.target.checked)} /> Aplicar em cofrinho
                    </label>
                </div>
                {editing ? (
                    <div className="form-group form-group--checkbox">
                        <label>
                            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Pago
                        </label>
                    </div>
                ) : (
                    <p className="card-metric-hint">
                        Cartão de crédito entra como pendente; PIX/conta como pago (editável após salvar).
                    </p>
                )}
                <footer className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </footer>
            </form>
        </ModalShell>
    );
}
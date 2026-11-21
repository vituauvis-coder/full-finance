import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { normalizeSplitScope } from '@motor/dinheiro/split-net.js';
import type { Account, ExpenseSplitRequest, Movement } from '../../../lib/types/finance';
import { formatBRL } from '../../../lib/format';
import { DialogForm, DialogFrame } from '../../../components/ui/dialog';
import {
    FormActions,
    FormAlert,
    FormField,
    FormGrid,
    FormInput,
    FormSelect
} from '../../../components/ui/form';
import { useConfirm } from '../../../components/ui/confirm';
import {
    cancelExpenseSplitRequest,
    createExpenseSplitRequest,
    fetchUsersForSplit,
    type SplitUserOption
} from '../api/expenseSplits';
import {
    computeSplitMoneyContext,
    monthKeyFromExpenseDate,
    outgoingForExpense,
    splitScopeLabel,
    splitStatusClass,
    splitStatusLabel
} from '../domain/expenseSplitUi';

type Props = {
    open: boolean;
    expense: Movement | null;
    accounts: Account[];
    outgoing: ExpenseSplitRequest[];
    currency: string;
    preferredScope?: 'FULL_EXPENSE' | 'INSTALLMENT';
    preferredInstallmentIndex?: number | null;
    preferredPeriodKey?: string | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function ExpenseSplitModal({
    open,
    expense,
    accounts,
    outgoing,
    currency,
    preferredScope,
    preferredInstallmentIndex,
    preferredPeriodKey,
    onClose,
    onSaved
}: Props) {
    const { confirm } = useConfirm();
    const [users, setUsers] = useState<SplitUserOption[]>([]);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [scope, setScope] = useState<'FULL_EXPENSE' | 'INSTALLMENT'>('FULL_EXPENSE');
    const [installmentIndex, setInstallmentIndex] = useState('');
    const [amountMode, setAmountMode] = useState<'per_installment' | 'total'>('per_installment');
    const [amount, setAmount] = useState('');
    const [creditAccountId, setCreditAccountId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const nParc = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    const existing = useMemo(
        () => (expense ? outgoingForExpense(outgoing, expense.id) : []),
        [expense, outgoing]
    );

    const money = useMemo(() => {
        if (!expense) return null;
        const idx = parseInt(installmentIndex, 10);
        return computeSplitMoneyContext(
            expense,
            outgoing,
            scope,
            Number.isFinite(idx) ? idx : null
        );
    }, [expense, outgoing, scope, installmentIndex]);

    useEffect(() => {
        if (!open || !expense) return;
        setError(null);
        setRecipientEmail('');
        const wantScope =
            preferredScope === 'INSTALLMENT' && nParc >= 2 ? 'INSTALLMENT' : 'FULL_EXPENSE';
        setScope(wantScope);
        setInstallmentIndex(
            wantScope === 'INSTALLMENT' && preferredInstallmentIndex
                ? String(preferredInstallmentIndex)
                : ''
        );
        setAmountMode('per_installment');
        setCreditAccountId(accounts[0]?.id ?? '');
        setUsersError(null);
        void fetchUsersForSplit()
            .then((r) => setUsers(r.users ?? []))
            .catch((err) => {
                setUsers([]);
                setUsersError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
            });
    }, [open, expense, preferredScope, preferredInstallmentIndex, nParc, accounts]);

    useEffect(() => {
        if (!open || !money) return;
        const { remaining, n, per, scope: sc } = money;
        if (sc === 'FULL_EXPENSE' && n >= 2 && amountMode === 'per_installment') {
            const maxPer = remaining / n;
            const defPer = Math.min(maxPer, per / 2);
            setAmount(String(Math.max(0.01, defPer).toFixed(2)));
        } else {
            setAmount(String(Math.min(remaining, Math.max(0.01, remaining / 2)).toFixed(2)));
        }
    }, [open, money?.remaining, money?.n, money?.per, money?.scope, amountMode, scope, installmentIndex]);

    const desc = String(expense?.description || '').trim() || 'Saída';
    const showAmountMode = !!(money && money.scope === 'FULL_EXPENSE' && money.n >= 2);
    const amountLabel =
        showAmountMode && amountMode === 'per_installment' ? 'Valor por parcela' : 'Valor';
    const maxHint = money
        ? showAmountMode && amountMode === 'per_installment'
            ? `Máx. ${formatBRL(money.remaining / money.n, currency)}/parcela`
            : `Máx. ${formatBRL(money.remaining, currency)}`
        : undefined;

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!expense || !money) return;
        const email = recipientEmail.trim().toLowerCase();
        let amt = parseFloat(amount);
        if (!email || !Number.isFinite(amt) || amt <= 0) {
            setError('Selecione o destinatário e o valor.');
            return;
        }
        if (money.scope === 'FULL_EXPENSE' && money.n >= 2 && amountMode === 'per_installment') {
            amt *= money.n;
        }
        if (amt > money.remaining + 0.005) {
            setError(`O máximo neste alvo é ${formatBRL(money.remaining, currency)}.`);
            return;
        }
        if (money.scope === 'INSTALLMENT' && !money.installmentIndex) {
            setError('Selecione a parcela.');
            return;
        }
        if (!creditAccountId) {
            setError('Selecione a conta do estorno.');
            return;
        }
        const periodKey =
            money.scope === 'INSTALLMENT' && money.installmentIndex
                ? preferredPeriodKey || monthKeyFromExpenseDate(expense, money.installmentIndex)
                : null;
        setSaving(true);
        setError(null);
        try {
            await createExpenseSplitRequest({
                sourceExpenseId: expense.id,
                recipientEmail: email,
                amount: amt,
                requesterCreditAccountId: creditAccountId,
                splitScope: money.scope,
                targetInstallmentIndex:
                    money.scope === 'INSTALLMENT' ? money.installmentIndex : null,
                targetPeriodKey: periodKey,
                ...(money.n >= 2 ? { sourceInstallmentCount: Math.min(99, money.n) } : {})
            });
            await onSaved();
            setRecipientEmail('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
        } finally {
            setSaving(false);
        }
    }

    async function onRemove(splitId: string) {
        const ok = await confirm({
            title: 'Remover divisão?',
            message: 'Só é permitido se ainda não foi aceita.',
            confirmLabel: 'Remover',
            tone: 'danger'
        });
        if (!ok) return;
        setRemovingId(splitId);
        try {
            await cancelExpenseSplitRequest(splitId);
            await onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível remover.');
        } finally {
            setRemovingId(null);
        }
    }

    return (
        <DialogFrame
            id="expense-split-modal"
            open={open}
            title="Dividir saída"
            onClose={onClose}
            size="md"
            panelClassName="modal-content--expense-split"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error || usersError} />

                {money ? (
                    <div className="expense-split-modal__summary" role="status">
                        <p className="expense-split-modal__summary-title">{desc}</p>
                        <p className="expense-split-modal__summary-meta">
                            <span>{formatBRL(money.total, currency)}</span>
                            <span className="expense-split-modal__dot" aria-hidden="true">
                                ·
                            </span>
                            <span>
                                disponível {formatBRL(money.remaining, currency)}
                                {money.n >= 2 ? ` · ${money.n}x` : ''}
                            </span>
                        </p>
                    </div>
                ) : null}

                <FormField id="expense-split-recipient" label="Destinatário">
                    <FormSelect
                        id="expense-split-recipient"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        required
                        disabled={users.length === 0}
                    >
                        <option value="">
                            {users.length === 0 ? 'Nenhum outro usuário' : 'Selecione…'}
                        </option>
                        {users.map((u) => (
                            <option key={u.id} value={String(u.email || '').trim().toLowerCase()}>
                                {u.name?.trim() ? `${u.name.trim()} — ${u.email}` : u.email}
                            </option>
                        ))}
                    </FormSelect>
                </FormField>

                {nParc >= 2 ? (
                    <FormGrid columns={2}>
                        <FormField id="expense-split-scope" label="Tipo">
                            <FormSelect
                                id="expense-split-scope"
                                value={scope}
                                onChange={(e) => {
                                    const v = normalizeSplitScope(e.target.value) as
                                        | 'FULL_EXPENSE'
                                        | 'INSTALLMENT';
                                    setScope(v);
                                    if (v !== 'INSTALLMENT') setInstallmentIndex('');
                                }}
                            >
                                <option value="FULL_EXPENSE">Lançamento inteiro</option>
                                <option value="INSTALLMENT">Parcela específica</option>
                            </FormSelect>
                        </FormField>
                        {scope === 'INSTALLMENT' ? (
                            <FormField id="expense-split-installment-index" label="Parcela">
                                <FormSelect
                                    id="expense-split-installment-index"
                                    value={installmentIndex}
                                    onChange={(e) => setInstallmentIndex(e.target.value)}
                                    required
                                >
                                    <option value="">Selecione…</option>
                                    {Array.from({ length: nParc }, (_, i) => i + 1).map((i) => (
                                        <option key={i} value={String(i)}>
                                            {i}/{nParc}
                                        </option>
                                    ))}
                                </FormSelect>
                            </FormField>
                        ) : (
                            <FormField id="expense-split-amount-mode" label="Informar valor">
                                <div
                                    className="ui-form-segmented"
                                    role="group"
                                    aria-label="Modo do valor"
                                >
                                    <button
                                        type="button"
                                        className={`ui-form-segmented__btn${
                                            amountMode === 'per_installment' ? ' is-active' : ''
                                        }`}
                                        onClick={() => setAmountMode('per_installment')}
                                    >
                                        Por parcela
                                    </button>
                                    <button
                                        type="button"
                                        className={`ui-form-segmented__btn${
                                            amountMode === 'total' ? ' is-active' : ''
                                        }`}
                                        onClick={() => setAmountMode('total')}
                                    >
                                        Total
                                    </button>
                                </div>
                            </FormField>
                        )}
                    </FormGrid>
                ) : null}

                <FormGrid columns={2}>
                    <FormField id="expense-split-amount" label={amountLabel} hint={maxHint}>
                        <FormInput
                            id="expense-split-amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </FormField>
                    <FormField id="expense-split-credit-account" label="Conta do estorno">
                        <FormSelect
                            id="expense-split-credit-account"
                            value={creditAccountId}
                            onChange={(e) => setCreditAccountId(e.target.value)}
                            required
                        >
                            <option value="">Selecione…</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name || 'Conta'}
                                </option>
                            ))}
                        </FormSelect>
                    </FormField>
                </FormGrid>

                <div className="expense-split-modal-existing-wrap">
                    <h4 className="expense-split-modal-existing-title">Divisões</h4>
                    <div className="expense-split-modal-existing" aria-live="polite">
                        {existing.length === 0 ? (
                            <p className="expense-split-modal-existing-empty">Nenhuma ainda.</p>
                        ) : (
                            existing.map((s) => {
                                const st = String(s.status ?? '').toUpperCase();
                                const canRemove = st !== 'ACCEPTED';
                                const name = s.recipient?.name || s.recipient?.email || 'Destinatário';
                                const instTxt =
                                    normalizeSplitScope(s.splitScope) === 'INSTALLMENT' &&
                                    s.targetInstallmentIndex
                                        ? ` · ${s.targetInstallmentIndex}ª`
                                        : '';
                                return (
                                    <div
                                        key={s.id}
                                        className="expense-split-modal-existing__row"
                                        data-split-id={s.id}
                                    >
                                        <div className="expense-split-modal-existing__meta">
                                            <span
                                                className={`expense-split-status ${splitStatusClass(s.status)}`}
                                            >
                                                {splitStatusLabel(s.status)}
                                            </span>
                                            <strong>{name}</strong>
                                            <span className="expense-split-modal-existing__detail">
                                                {formatBRL(Number(s.amount) || 0, currency)} ·{' '}
                                                {splitScopeLabel(s.splitScope)}
                                                {instTxt}
                                            </span>
                                        </div>
                                        {canRemove ? (
                                            <button
                                                type="button"
                                                className="expense-split-modal-remove-btn"
                                                disabled={removingId === s.id}
                                                onClick={() => void onRemove(s.id)}
                                            >
                                                Remover
                                            </button>
                                        ) : (
                                            <span
                                                className="expense-split-modal-locked"
                                                title="Já aceita — não pode remover"
                                            >
                                                <i className="fas fa-lock" aria-hidden="true" />
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <FormActions onCancel={onClose} busy={saving} submitLabel="Enviar" />
            </DialogForm>
        </DialogFrame>
    );
}

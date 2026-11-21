import { FormEvent, useEffect, useState } from 'react';
import { DialogForm, DialogFrame } from '../../../components/ui/dialog';
import {
    FormActions,
    FormAlert,
    FormField,
    FormGrid,
    FormInput,
    FormSelect
} from '../../../components/ui/form';
import { sortedBankAccounts } from '../../../lib/accounts';
import type { Account } from '../../../lib/types/finance';
import { createAccount, updateAccount, type AccountFormPayload } from '../api/wallet';

type AccountKind = 'bank' | 'credit' | 'debit' | 'food' | 'meal';

type Props = {
    open: boolean;
    accounts: Account[];
    editing: Account | null;
    defaultLinkedBankId?: string;
    defaultKind?: AccountKind;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function WalletAccountFormModal({
    open,
    accounts,
    editing,
    defaultLinkedBankId,
    defaultKind = 'bank',
    onClose,
    onSaved
}: Props) {
    const [kind, setKind] = useState<AccountKind>('bank');
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [limit, setLimit] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [closeDay, setCloseDay] = useState('');
    const [linkedAccountId, setLinkedAccountId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const showKindPicker = !editing && kind !== 'food' && kind !== 'meal';

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setName(editing.name);
            setBalance(String(editing.balance ?? ''));
            setLimit(String((editing as Account & { limit?: number }).limit ?? ''));
            setDueDay(String((editing as Account & { dueDay?: number }).dueDay ?? ''));
            setCloseDay(String((editing as Account & { closeDay?: number }).closeDay ?? ''));
            setLinkedAccountId(String((editing as Account & { linkedAccountId?: string }).linkedAccountId ?? ''));
            const t = String(editing.type ?? '');
            if (t.includes('credito') || t.includes('crédito')) setKind('credit');
            else if (t === 'vale_alimentacao') setKind('food');
            else if (t === 'vale_refeicao') setKind('meal');
            else if (isCardLike(t)) setKind('debit');
            else setKind('bank');
        } else {
            setName('');
            setBalance('');
            setLimit('');
            setDueDay('10');
            setCloseDay('1');
            setKind(
                defaultKind === 'credit'
                    ? 'credit'
                    : defaultKind === 'debit'
                      ? 'debit'
                      : defaultKind === 'food'
                        ? 'food'
                        : defaultKind === 'meal'
                          ? 'meal'
                          : 'bank'
            );
            setLinkedAccountId(defaultLinkedBankId ?? '');
        }
    }, [open, editing, defaultKind, defaultLinkedBankId]);

    function resolveType() {
        if (kind === 'bank') return 'conta_corrente';
        if (kind === 'credit') return 'cartao_credito';
        if (kind === 'food') return 'vale_alimentacao';
        if (kind === 'meal') return 'vale_refeicao';
        return 'cartao_debito';
    }

    function modalTitle() {
        if (editing) return 'Editar conta';
        if (kind === 'credit') return 'Novo cartão de crédito';
        if (kind === 'debit') return 'Novo cartão de débito';
        if (kind === 'food') return 'Novo vale alimentação';
        if (kind === 'meal') return 'Novo vale refeição';
        return 'Nova conta';
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const payload: AccountFormPayload = {
            name: name.trim(),
            type: resolveType(),
            initialBalance: balance ? parseFloat(balance) : 0,
            linkedAccountId: linkedAccountId || null,
            limit: limit ? parseFloat(limit) : null,
            dueDay: dueDay ? parseInt(dueDay, 10) : null,
            closeDay: closeDay ? parseInt(closeDay, 10) : null
        };
        if (!payload.name) {
            setError('Informe o nome.');
            return;
        }
        if (kind !== 'bank' && !payload.linkedAccountId) {
            setError('Cartões precisam de uma conta bancária vinculada.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (editing) await updateAccount(editing.id, payload);
            else await createAccount(payload);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar conta.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <DialogFrame
            id="wallet-account-modal"
            open={open}
            title={modalTitle()}
            onClose={onClose}
            size="md"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                {showKindPicker ? <WalletAccountKindPicker kind={kind} setKind={setKind} /> : null}
                <FormField id="wallet-account-name" label="Nome">
                    <FormInput
                        id="wallet-account-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="off"
                        placeholder={kind === 'bank' ? 'Ex.: Itaú conta corrente' : undefined}
                    />
                </FormField>
                {kind === 'bank' ? (
                    <FormField id="wallet-account-balance" label="Saldo inicial" hint="Opcional — pode ajustar depois nos lançamentos.">
                        <FormInput
                            id="wallet-account-balance"
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="0,00"
                        />
                    </FormField>
                ) : null}
                {kind === 'credit' ? (
                    <>
                        <FormField id="wallet-account-limit" label="Limite (R$)">
                            <FormInput
                                id="wallet-account-limit"
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                            />
                        </FormField>
                        <FormGrid columns={2}>
                            <FormField id="wallet-account-close-day" label="Dia de fechamento">
                                <FormInput
                                    id="wallet-account-close-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={closeDay}
                                    onChange={(e) => setCloseDay(e.target.value)}
                                />
                            </FormField>
                            <FormField id="wallet-account-due-day" label="Dia de vencimento">
                                <FormInput
                                    id="wallet-account-due-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dueDay}
                                    onChange={(e) => setDueDay(e.target.value)}
                                />
                            </FormField>
                        </FormGrid>
                    </>
                ) : null}
                {kind !== 'bank' ? (
                    <FormField id="wallet-account-linked" label="Instituição vinculada">
                        <FormSelect
                            id="wallet-account-linked"
                            value={linkedAccountId}
                            onChange={(e) => setLinkedAccountId(e.target.value)}
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
                <FormActions
                    onCancel={onClose}
                    busy={busy}
                    submitLabel={editing ? 'Salvar' : 'Adicionar'}
                />
            </DialogForm>
        </DialogFrame>
    );
}

function WalletAccountKindPicker({
    kind,
    setKind
}: {
    kind: AccountKind;
    setKind: (k: AccountKind) => void;
}) {
    const options: { value: AccountKind; label: string }[] = [
        { value: 'bank', label: 'Conta' },
        { value: 'credit', label: 'Crédito' },
        { value: 'debit', label: 'Débito' }
    ];
    return (
        <div className="ui-form-field">
            <span className="ui-form-field__label" id="wallet-account-kind-label">
                Tipo
            </span>
            <div
                className="ui-form-segmented"
                role="group"
                aria-labelledby="wallet-account-kind-label"
            >
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        className={`ui-form-segmented__btn${kind === opt.value ? ' is-active' : ''}`}
                        aria-pressed={kind === opt.value}
                        onClick={() => setKind(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function isCardLike(type: string) {
    const t = type.toLowerCase();
    return t.includes('debito') || t.includes('débito') || t.includes('beneficio');
}
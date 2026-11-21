import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    cardInstallmentAmount,
    installmentCount,
    normalizePaymentMethod,
    paidFromCofrinho as expensePaidFromCofrinho
} from '@motor/viagens/trip-expense-payment.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import type { TripDestination, TripExpense, TripExpensePaymentMethod, TripPayload } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { ExpenseDateField } from './ExpenseDateField';
import { ORCAMENTO_CATEGORIES, orcamentoCategoryLabel, type OrcamentoCategoryId } from './orcamento-model';

function expenseCategorySelectValue(ex: TripExpense): string {
    if (ex.customCategoryId) return `custom:${ex.customCategoryId}`;
    return ex.category ?? 'extras';
}

function expenseCategoryLabel(ex: TripExpense, payload?: TripPayload | null): string {
    if (ex.customCategoryId) {
        const custom = payload?.budgetCustomCategories ?? payload?.budget_custom_categories ?? [];
        return custom.find((c) => c.id === ex.customCategoryId)?.label?.trim() || 'Extra';
    }
    const catId = ex.category ?? 'extras';
    const def = ORCAMENTO_CATEGORIES.find((c) => c.id === catId);
    return orcamentoCategoryLabel(payload, catId, def?.label ?? String(catId));
}

export function expenseDescriptionValue(ex: TripExpense): string {
    if (ex.description != null && ex.description !== '') return ex.description;
    const legacy = (ex as { title?: string }).title;
    return legacy != null ? legacy : '';
}

function expenseDateShort(spentOn?: string): string {
    if (!spentOn?.trim()) return '—';
    const d = new Date(`${spentOn.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return spentOn;
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).replace(/\./g, '');
}

function parseAmountInput(raw: string): number {
    const norm = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!norm) return 0;
    const n = Number(norm);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function ExpenseAmountField({
    amount,
    onCommit
}: {
    amount: number;
    onCommit: (n: number) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const cancelRef = useRef(false);

    function beginEdit() {
        setEditing(true);
        setDraft(amount > 0 ? String(amount) : '');
    }

    function commit() {
        setEditing(false);
        onCommit(parseAmountInput(draft));
    }

    function handleBlur() {
        if (cancelRef.current) {
            cancelRef.current = false;
            setEditing(false);
            return;
        }
        if (!editing) return;
        commit();
    }

    const shown = editing ? draft : amount > 0 ? formatBRL(amount) : '';

    return (
        <input
            type="text"
            inputMode="decimal"
            className="orc-exp-edit__input orc-exp-edit__input--amount"
            placeholder="R$ 0,00"
            aria-label="Valor do lançamento"
            value={shown}
            onFocus={beginEdit}
            onBlur={handleBlur}
            onChange={(e) => {
                if (editing) setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                    cancelRef.current = true;
                    e.currentTarget.blur();
                }
            }}
        />
    );
}

export type TripCreditAccountOption = { id: string; name: string };

type Props = {
    ex: TripExpense;
    destinations: TripDestination[];
    creditAccounts: TripCreditAccountOption[];
    isEditing: boolean;
    onStartEdit: () => void;
    onEndEdit: () => void;
    onChange: (e: TripExpense) => void;
    onDelete: () => void;
    tripPayload?: TripPayload | null;
};

export function ExpenseRow({
    ex,
    destinations,
    creditAccounts,
    isEditing,
    onStartEdit,
    onEndEdit,
    onChange,
    onDelete,
    tripPayload = null
}: Props) {
    const cardRef = useRef<HTMLLIElement>(null);
    const payMethod = normalizePaymentMethod(ex.paymentMethod ?? ex.payment_method);
    const accountId = ex.accountId ?? ex.account_id ?? '';
    const installments = installmentCount(ex);
    const parcela = cardInstallmentAmount(ex);
    const amount = Number(ex.amount ?? 0) || 0;
    const title = expenseDescriptionValue(ex).trim();
    const destName = destinations.find((d) => d.id === ex.destinationId)?.name ?? '';
    const catLabel = expenseCategoryLabel(ex, tripPayload);

    function setPaymentMethod(method: TripExpensePaymentMethod) {
        onChange({
            ...ex,
            paymentMethod: method,
            payment_method: method,
            installments: method === 'credit_card' ? Math.max(1, installments) : 1,
            ...(method === 'credit_card'
                ? { paidFromCofrinho: false, paid_from_cofrinho: false }
                : {})
        });
    }

    const fromCofrinho = expensePaidFromCofrinho(ex);

    const payLabel =
        payMethod === 'credit_card' ? (installments > 1 ? `Cartão ${installments}x` : 'Cartão') : 'Pix';

    const parcelHint =
        payMethod === 'credit_card' && installments > 1 && amount > 0
            ? `${installments}x de ${formatBRL(parcela)}`
            : null;

    function handleCancel() {
        if (amount <= 0 && !title) onDelete();
        else onEndEdit();
    }

    if (!isEditing) {
        return (
            <li className="orc-exp-view">
                <button type="button" className="orc-exp-view__hit" onClick={onStartEdit} aria-label={`Editar ${title || 'lançamento'}`}>
                    <div className="orc-exp-view__copy">
                        <span className={`orc-exp-view__title${title ? '' : ' is-empty'}`}>
                            {title || 'Sem nome'}
                        </span>
                        <span className="orc-exp-view__meta">
                            <span className="orc-exp-view__chip orc-exp-view__chip--cat">{catLabel}</span>
                            <span className="orc-exp-view__date">{expenseDateShort(ex.spentOn)}</span>
                            <span
                                className={`orc-exp-view__chip orc-exp-view__chip--pay orc-exp-view__chip--pay-${payMethod}`}
                            >
                                {payLabel}
                            </span>
                            {fromCofrinho ? (
                                <span className="orc-exp-view__chip orc-exp-view__chip--cofrinho">Cofrinho</span>
                            ) : null}
                            {destName ? <span className="orc-exp-view__dest">{destName}</span> : null}
                        </span>
                    </div>
                    <strong className="orc-exp-view__amount">{formatBRL(amount)}</strong>
                    <MaterialIcon className="orc-exp-view__chev" name="edit" variant="app" opticalSize={16} aria-hidden />
                </button>
                <button
                    type="button"
                    className="orc-exp-view__del"
                    aria-label="Excluir lançamento"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <DeleteIcon size="sm" />
                </button>
            </li>
        );
    }

    return (
        <li ref={cardRef} className="orc-exp-card orc-exp-card--edit">
            <header className="orc-exp-edit__head">
                <span className="orc-exp-edit__head-title">Editando lançamento</span>
            </header>

            <div className="orc-exp-edit__body">
                <div className="orc-exp-edit__row orc-exp-edit__row--main">
                    <label className="orc-exp-edit__field orc-exp-edit__field--desc">
                        <span className="orc-exp-edit__field-label">Descrição</span>
                        <input
                            className="orc-exp-edit__input"
                            value={expenseDescriptionValue(ex)}
                            placeholder="Nome do gasto"
                            onChange={(e) => onChange({ ...ex, description: e.target.value })}
                            autoFocus
                        />
                    </label>
                    <label className="orc-exp-edit__field orc-exp-edit__field--amount">
                        <span className="orc-exp-edit__field-label">Valor</span>
                        <ExpenseAmountField amount={amount} onCommit={(n) => onChange({ ...ex, amount: n })} />
                    </label>
                    <label className="orc-exp-edit__field orc-exp-edit__field--date">
                        <span className="orc-exp-edit__field-label">Data</span>
                        <ExpenseDateField
                            value={ex.spentOn}
                            onChange={(spentOn) => onChange({ ...ex, spentOn })}
                        />
                    </label>
                </div>

                <div
                    className={`orc-exp-edit__row orc-exp-edit__row--meta${payMethod === 'pix' ? ' orc-exp-edit__row--meta-cofrinho' : ''}`}
                >
                    <label className="orc-exp-edit__field">
                        <span className="orc-exp-edit__field-label">Categoria</span>
                        <select
                            className="orc-exp-edit__input"
                            value={expenseCategorySelectValue(ex)}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v.startsWith('custom:')) {
                                    onChange({
                                        ...ex,
                                        category: 'extras',
                                        customCategoryId: v.slice(7)
                                    });
                                } else {
                                    onChange({
                                        ...ex,
                                        category: v as OrcamentoCategoryId,
                                        customCategoryId: null
                                    });
                                }
                            }}
                        >
                            {ORCAMENTO_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {orcamentoCategoryLabel(tripPayload, c.id, c.label)}
                                </option>
                            ))}
                            {(tripPayload?.budgetCustomCategories ?? tripPayload?.budget_custom_categories ?? [])
                                .length > 0 ? (
                                <optgroup label="Suas categorias">
                                    {(tripPayload?.budgetCustomCategories ?? tripPayload?.budget_custom_categories ?? []).map(
                                        (c) => (
                                            <option key={c.id} value={`custom:${c.id}`}>
                                                {c.label?.trim() || c.id}
                                            </option>
                                        )
                                    )}
                                </optgroup>
                            ) : null}
                        </select>
                    </label>
                    <label className="orc-exp-edit__field">
                        <span className="orc-exp-edit__field-label">Destino</span>
                        <select
                            className="orc-exp-edit__input"
                            value={ex.destinationId ?? ''}
                            onChange={(e) => onChange({ ...ex, destinationId: e.target.value || null })}
                        >
                            <option value="">Nenhum</option>
                            {destinations.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {payMethod === 'pix' ? (
                        <div className="orc-exp-edit__field orc-exp-edit__field--cofrinho">
                            <span className="orc-exp-edit__field-label">Cofrinho</span>
                            <label className="orc-exp-edit__cofrinho">
                                <input
                                    type="checkbox"
                                    checked={fromCofrinho}
                                    onChange={(e) =>
                                        onChange({
                                            ...ex,
                                            paidFromCofrinho: e.target.checked,
                                            paid_from_cofrinho: e.target.checked
                                        })
                                    }
                                />
                                <span>Debitar da meta</span>
                            </label>
                        </div>
                    ) : null}
                </div>

                <div className="orc-exp-edit__row orc-exp-edit__row--pay">
                    <div className="orc-exp-edit__field orc-exp-edit__field--pay">
                        <span className="orc-exp-edit__field-label">Pagamento</span>
                        <div className="orc-exp-edit__pay-stack">
                            <div className="orc-exp-pay orc-exp-pay--inline" role="group" aria-label="Forma de pagamento">
                                <button
                                    type="button"
                                    className={`orc-exp-pay__opt orc-exp-pay__opt--pix${payMethod === 'pix' ? ' is-active' : ''}`}
                                    onClick={() => setPaymentMethod('pix')}
                                >
                                    <MaterialIcon name="payments" variant="app" opticalSize={14} aria-hidden />
                                    Pix
                                </button>
                                <button
                                    type="button"
                                    className={`orc-exp-pay__opt orc-exp-pay__opt--card${payMethod === 'credit_card' ? ' is-active' : ''}`}
                                    onClick={() => setPaymentMethod('credit_card')}
                                >
                                    <MaterialIcon name="credit_card" variant="app" opticalSize={14} aria-hidden />
                                    Cartão
                                </button>
                            </div>
                            {payMethod === 'credit_card' ? (
                                <div className="orc-exp-edit__inst">
                                    <label className="orc-exp-edit__inst-label orc-exp-edit__inst-label--card">
                                        <span>Cartão</span>
                                        <select
                                            className="orc-exp-edit__input orc-exp-edit__input--card"
                                            value={accountId}
                                            onChange={(e) =>
                                                onChange({
                                                    ...ex,
                                                    accountId: e.target.value || null,
                                                    account_id: e.target.value || null
                                                })
                                            }
                                            aria-label="Cartão de crédito"
                                            aria-invalid={!accountId && amount > 0 ? true : undefined}
                                        >
                                            <option value="">Selecione…</option>
                                            {creditAccounts.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {creditAccounts.length === 0 ? (
                                        <p className="orc-exp-edit__pay-hint">
                                            Nenhum cartão na Carteira.{' '}
                                            <Link className="orc-exp-edit__wallet-link" to="/dinheiro/carteira">
                                                Abrir Carteira
                                            </Link>
                                        </p>
                                    ) : !accountId && amount > 0 ? (
                                        <p className="orc-exp-edit__pay-hint is-warn">
                                            Escolha o cartão para espelhar no Dinheiro.
                                        </p>
                                    ) : null}
                                    <label className="orc-exp-edit__inst-label">
                                        <span>Parcelas</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="orc-exp-edit__input orc-exp-edit__input--inst"
                                            value={String(installments)}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\D/g, '');
                                                if (!raw) {
                                                    onChange({ ...ex, installments: 1 });
                                                    return;
                                                }
                                                const n = Math.min(48, Math.max(1, Number(raw) || 1));
                                                onChange({ ...ex, installments: n });
                                            }}
                                            aria-label="Número de parcelas"
                                        />
                                    </label>
                                    {parcelHint ? <span className="orc-exp-edit__pay-hint">{parcelHint}</span> : null}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <footer className="orc-exp-edit__foot">
                <button type="button" className="orc-exp-edit__cancel" onClick={handleCancel}>
                    {amount <= 0 && !title ? 'Descartar' : 'Cancelar'}
                </button>
                <button
                    type="button"
                    className="orc-exp-edit__done"
                    onClick={() => {
                        const amountEl = cardRef.current?.querySelector<HTMLInputElement>(
                            '.orc-exp-edit__input--amount'
                        );
                        amountEl?.blur();
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                        window.setTimeout(() => onEndEdit(), 0);
                    }}
                >
                    <MaterialIcon name="check" variant="app" opticalSize={16} />
                    Concluir
                </button>
            </footer>
        </li>
    );
}
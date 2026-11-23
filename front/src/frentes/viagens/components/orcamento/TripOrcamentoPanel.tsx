import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { fetchFinanceData } from '../../../dinheiro/api/finance';
import { createExpense, deleteExpense } from '../../../dinheiro/api/movements';
import { EXPENSE_COFRINHO_CATEGORY } from '../../../dinheiro/domain/cofrinhoConstants';
import { isCreditCardType, isPixBankAccountType } from '../../../../lib/accounts';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { Trip, TripCofrinhoMeta, TripDestination, TripExpense, TripFinanceMovementLine } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import type { TripDraft } from '../ViagemFicha';
import {
    buildOrcamentoSnapshot,
    ORCAMENTO_CATEGORIES,
    defaultOrcamentoCategoryLabel,
    isBuiltinOrcamentoCategory,
    nextCustomCategoryIcon,
    patchDeposits,
    readDeposits,
    readBudgetCategoryLabels,
    type PiggyDeposit
} from './orcamento-model';
import { CategoryLedgerPop } from './CategoryLedgerPop';
import { ExpenseRow } from './ExpenseRow';
import { PiggyAportePop } from './PiggyAportePop';
import { OrcamentoOverview } from './OrcamentoOverview';
import { PayMethodChips } from './PayMethodChips';
import { PiggyHistoryPop } from './PiggyHistoryPop';
import '../../styles/orcamento-workspace.css';

function sortExpenses(list: TripExpense[]): TripExpense[] {
    return [...list].sort((a, b) => String(b.spentOn ?? '').localeCompare(String(a.spentOn ?? '')));
}

function parseCapInput(raw: string): number {
    const norm = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!norm) return 0;
    const n = Number(norm);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

type Props = {
    trip: Trip;
    draft: TripDraft;
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
    /** Dispara save imediato após concluir edição de gasto (sync cartão → Dinheiro). */
    onFlushSave?: () => void | Promise<void>;
    expenseAuthors?: Record<string, { id: string; name: string }>;
    financeMovements?: TripFinanceMovementLine[];
    tripCofrinhoMeta?: TripCofrinhoMeta | null;
    onFinanceRefresh?: () => void | Promise<void>;
};

export function TripOrcamentoPanel({
    trip,
    draft,
    onPatch,
    onFlushSave,
    expenseAuthors,
    financeMovements = [],
    tripCofrinhoMeta = null,
    onFinanceRefresh
}: Props) {
    const snap = useMemo(
        () => buildOrcamentoSnapshot(draft, new Date(), { financeMovements, cofrinhoMeta: tripCofrinhoMeta }),
        [draft, financeMovements, tripCofrinhoMeta]
    );
    const [aporteOpen, setAporteOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [ledgerCategoryId, setLedgerCategoryId] = useState<string | null>(null);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const expenseOrderFrozen = useRef<string[] | null>(null);
    const [metaEdit, setMetaEdit] = useState(false);
    const destinations = draft.payload.destinations ?? [];
    const [creditAccounts, setCreditAccounts] = useState<{ id: string; name: string }[]>([]);
    const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        let cancelled = false;
        void fetchFinanceData()
            .then((data) => {
                if (cancelled) return;
                const accounts = data.userAccounts ?? [];
                setCreditAccounts(
                    accounts
                        .filter((a) => isCreditCardType(a.type))
                        .map((a) => ({ id: a.id, name: a.name || 'Cartão' }))
                );
                setBankAccounts(
                    accounts
                        .filter((a) => isPixBankAccountType(a.type))
                        .map((a) => ({ id: a.id, name: a.name || 'Conta' }))
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setCreditAccounts([]);
                    setBankAccounts([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function freezeExpenseOrder() {
        if (expenseOrderFrozen.current === null) {
            expenseOrderFrozen.current = sortExpenses(draft.payload.expenses ?? []).map((e) => e.id);
        }
    }

    function openExpenseEdit(id: string) {
        freezeExpenseOrder();
        setEditingExpenseId(id);
    }

    function closeExpenseEdit() {
        setEditingExpenseId(null);
        expenseOrderFrozen.current = null;
        window.setTimeout(() => void onFlushSave?.(), 80);
    }

    function setGoal(value: number) {
        onPatch((d) => ({
            ...d,
            payload: { ...d.payload, tripGoal: value, trip_goal: value }
        }));
    }

    function setCap(cat: string, value: number) {
        onPatch((d) => ({
            ...d,
            budgetCaps: { ...(d.budgetCaps ?? {}), [cat]: value }
        }));
    }

    function clearCap(cat: string) {
        onPatch((d) => {
            const next = { ...d.budgetCaps };
            delete next[cat];
            return { ...d, budgetCaps: next };
        });
    }

    function addCustomCategory() {
        const id = `custom_${crypto.randomUUID().slice(0, 8)}`;
        onPatch((d) => {
            const custom = [...(d.payload.budgetCustomCategories ?? d.payload.budget_custom_categories ?? [])];
            custom.push({ id, label: 'Nova categoria' });
            return {
                ...d,
                payload: {
                    ...d.payload,
                    budgetCustomCategories: custom,
                    budget_custom_categories: custom
                }
            };
        });
    }

    function cycleCustomCategoryIcon(id: string, currentIcon: string) {
        const next = nextCustomCategoryIcon(currentIcon);
        onPatch((d) => {
            const custom = (d.payload.budgetCustomCategories ?? d.payload.budget_custom_categories ?? []).map((c) =>
                c.id === id ? { ...c, icon: next } : c
            );
            return {
                ...d,
                payload: {
                    ...d.payload,
                    budgetCustomCategories: custom,
                    budget_custom_categories: custom
                }
            };
        });
    }

    function removeCustomCategory(id: string) {
        if (isBuiltinOrcamentoCategory(id)) return;
        onPatch((d) => {
            const custom = (d.payload.budgetCustomCategories ?? d.payload.budget_custom_categories ?? []).filter(
                (c) => c.id !== id
            );
            const nextCaps = { ...(d.budgetCaps ?? {}) };
            delete nextCaps[id];
            const expenses = (d.payload.expenses ?? []).map((ex) =>
                ex.customCategoryId === id ? { ...ex, customCategoryId: null, category: 'extras' } : ex
            );
            return {
                ...d,
                budgetCaps: nextCaps,
                payload: {
                    ...d.payload,
                    budgetCustomCategories: custom,
                    budget_custom_categories: custom,
                    expenses
                }
            };
        });
        if (ledgerCategoryId === id) setLedgerCategoryId(null);
    }

    function setCategoryLabel(catId: string, label: string) {
        const trimmed = label.trim();
        const defaultLabel = defaultOrcamentoCategoryLabel(catId);
        onPatch((d) => {
            const custom = [
                ...(d.payload.budgetCustomCategories ?? d.payload.budget_custom_categories ?? [])
            ];
            const customIdx = custom.findIndex((c) => c.id === catId);
            if (customIdx >= 0) {
                custom[customIdx] = {
                    ...custom[customIdx],
                    label: trimmed || custom[customIdx].id
                };
                return {
                    ...d,
                    payload: {
                        ...d.payload,
                        budgetCustomCategories: custom,
                        budget_custom_categories: custom
                    }
                };
            }
            const labels = { ...readBudgetCategoryLabels(d.payload) };
            if (!trimmed || trimmed === defaultLabel) delete labels[catId];
            else labels[catId] = trimmed;
            return {
                ...d,
                payload: {
                    ...d.payload,
                    budgetCategoryLabels: labels,
                    budget_category_labels: labels
                }
            };
        });
    }

    const financeAportes = useMemo(
        () => financeMovements.filter((l) => l.ledgerKind === 'aporte'),
        [financeMovements]
    );

    const depositHistory = useMemo((): PiggyDeposit[] => {
        if (financeAportes.length > 0) {
            return financeAportes.map((l) => ({
                id: `finance::${l.id}`,
                amount: l.amount,
                recordedOn: l.date ?? undefined,
                monthKey: l.date?.slice(0, 7),
                note: l.description,
                authorName: l.author?.name
            }));
        }
        return readDeposits(draft.payload);
    }, [draft.payload, financeAportes]);

    async function addDeposit(amount: number, recordedOn: string) {
        const accountId = bankAccounts[0]?.id;
        if (!accountId) {
            window.alert('Cadastre uma conta corrente na Carteira para registrar o aporte no extrato.');
            return;
        }
        const title = String(trip.title ?? '').trim() || 'Viagem';
        try {
            await createExpense({
                description: `Aporte — ${title}`,
                amount,
                accountId,
                category: EXPENSE_COFRINHO_CATEGORY,
                subcategory: title,
                date: recordedOn,
                isPaid: true,
                isCofrinho: true,
                tripId: trip.id
            });
            window.dispatchEvent(new Event('finance:data-changed'));
            await onFinanceRefresh?.();
        } catch (e) {
            window.alert(e instanceof Error ? e.message : 'Não foi possível registrar o aporte.');
        }
    }

    async function removeDeposit(id: string) {
        if (id.startsWith('finance::')) {
            const expenseId = id.slice('finance::'.length);
            if (!expenseId || !window.confirm('Excluir este aporte? A linha some do Cofrinhos e do extrato (Saídas).')) {
                return;
            }
            try {
                await deleteExpense(expenseId);
                window.dispatchEvent(new Event('finance:data-changed'));
                await onFinanceRefresh?.();
            } catch (e) {
                window.alert(e instanceof Error ? e.message : 'Não foi possível excluir o aporte.');
            }
            return;
        }
        onPatch((d) => {
            const list = readDeposits(d.payload).filter((x) => x.id !== id);
            return patchDeposits(d, list);
        });
    }

    function setExpenses(next: TripExpense[]) {
        onPatch((d) => ({ ...d, payload: { ...d.payload, expenses: next } }));
    }

    function newExpense(partial: Partial<TripExpense> = {}) {
        const today = new Date().toISOString().slice(0, 10);
        return {
            id: crypto.randomUUID(),
            amount: 0,
            category: 'extras',
            description: '',
            spentOn: today,
            paymentMethod: 'pix' as const,
            installments: 1,
            ...partial
        } satisfies TripExpense;
    }

    function addExpense() {
        const created = newExpense();
        freezeExpenseOrder();
        setExpenses([...(draft.payload.expenses ?? []), created]);
        if (expenseOrderFrozen.current) expenseOrderFrozen.current.push(created.id);
        setEditingExpenseId(created.id);
    }

    function addExpenseInCategory(categoryId: string) {
        const isBuiltin = ORCAMENTO_CATEGORIES.some((c) => c.id === categoryId);
        const created = newExpense(
            isBuiltin
                ? { category: categoryId, customCategoryId: null }
                : { category: 'extras', customCategoryId: categoryId }
        );
        freezeExpenseOrder();
        setExpenses([...(draft.payload.expenses ?? []), created]);
        if (expenseOrderFrozen.current) expenseOrderFrozen.current.push(created.id);
        setEditingExpenseId(created.id);
    }

    const expenses = useMemo(() => {
        const list = draft.payload.expenses ?? [];
        const frozen = expenseOrderFrozen.current;
        if (frozen?.length) {
            const byId = new Map(list.map((e) => [e.id, e]));
            return frozen.map((id) => byId.get(id)).filter((x): x is TripExpense => Boolean(x));
        }
        return sortExpenses(list);
    }, [draft.payload.expenses, editingExpenseId]);

    return (
        <section className="orc-workspace" aria-label="Orçamento da viagem">
            <OrcamentoOverview
                snap={snap}
                metaEdit={metaEdit}
                displayGoal={snap.goal > 0 ? snap.goal : snap.totalCaps}
                goalFromCaps={snap.goalFromCaps}
                manualGoal={snap.goal}
                onStartMetaEdit={() => setMetaEdit(true)}
                onGoalInput={(value) => {
                    setGoal(value);
                    setMetaEdit(false);
                }}
                onCancelMetaEdit={() => setMetaEdit(false)}
                onOpenHistory={() => setHistoryOpen(true)}
                onOpenAporte={() => setAporteOpen(true)}
            />

            <div className="orc-columns">
                <section className="orc-panel orc-panel--categories" aria-labelledby="orc-cat-title">
                    <div className="orc-panel__head">
                        <h3 id="orc-cat-title" className="orc-panel__title">
                            Categorias
                        </h3>
                        <button
                            type="button"
                            className="orc-panel__add"
                            aria-label="Nova categoria"
                            title="Nova categoria"
                            onClick={addCustomCategory}
                        >
                            <MaterialIcon name="add" variant="app" opticalSize={18} />
                        </button>
                    </div>
                    <div className="orc-panel__scroll">
                        <ul className="orc-cat-list">
                            {snap.categoryRows.map((row) => (
                                <CategoryBudgetRow
                                    key={row.id}
                                    row={row}
                                    defaultLabel={defaultOrcamentoCategoryLabel(row.id)}
                                    cap={Number(draft.budgetCaps?.[row.id] ?? row.cap) || 0}
                                    isCustom={!isBuiltinOrcamentoCategory(row.id)}
                                    onCapChange={(v) => setCap(row.id, v)}
                                    onClear={() => clearCap(row.id)}
                                    onLabelChange={(label) => setCategoryLabel(row.id, label)}
                                    onRemove={
                                        isBuiltinOrcamentoCategory(row.id)
                                            ? undefined
                                            : () => removeCustomCategory(row.id)
                                    }
                                    onCycleIcon={
                                        isBuiltinOrcamentoCategory(row.id)
                                            ? undefined
                                            : () => cycleCustomCategoryIcon(row.id, row.icon)
                                    }
                                    onOpen={() => setLedgerCategoryId(row.id)}
                                />
                            ))}
                        </ul>
                    </div>
                    <p className="orc-cat-foot-total" title="Soma dos tetos por categoria">
                        <span className="orc-cat-foot-total__label">Soma dos tetos</span>
                        <strong className="orc-cat-foot-total__value">{formatBRL(snap.totalCaps)}</strong>
                    </p>
                </section>

                <section className="orc-panel orc-panel--expenses" aria-labelledby="orc-exp-title">
                    <div className="orc-panel__head">
                        <h3 id="orc-exp-title" className="orc-panel__title">
                            Lançamentos
                        </h3>
                        <button type="button" className="orc-panel__add" aria-label="Novo lançamento" onClick={addExpense}>
                            <MaterialIcon name="add" variant="app" opticalSize={18} />
                        </button>
                    </div>
                    <div className="orc-panel__scroll">
                        {expenses.length === 0 ? (
                            <p className="orc-exp-empty">Nenhum gasto lançado ainda.</p>
                        ) : (
                            <ul className="orc-exp-list">
                                {expenses.map((ex) => (
                                    <ExpenseRow
                                        key={ex.id}
                                        ex={ex}
                                        destinations={destinations}
                                        creditAccounts={creditAccounts}
                                        bankAccounts={bankAccounts}
                                        isEditing={editingExpenseId === ex.id}
                                        onStartEdit={() => openExpenseEdit(ex.id)}
                                        onEndEdit={closeExpenseEdit}
                                        tripPayload={draft.payload}
                                        author={expenseAuthors?.[ex.id] ?? null}
                                        onChange={(next) =>
                                            setExpenses(expenses.map((x) => (x.id === ex.id ? next : x)))
                                        }
                                        onDelete={() => {
                                            setExpenses(expenses.filter((x) => x.id !== ex.id));
                                            if (expenseOrderFrozen.current) {
                                                expenseOrderFrozen.current = expenseOrderFrozen.current.filter(
                                                    (id) => id !== ex.id
                                                );
                                            }
                                            if (editingExpenseId === ex.id) closeExpenseEdit();
                                        }}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>

            {aporteOpen ? <PiggyAportePop onClose={() => setAporteOpen(false)} onSave={addDeposit} /> : null}
            {historyOpen ? (
                <PiggyHistoryPop
                    deposits={depositHistory}
                    onClose={() => setHistoryOpen(false)}
                    onDelete={(id) => {
                        void removeDeposit(id);
                    }}
                />
            ) : null}
            {ledgerCategoryId ? (
                <CategoryLedgerPop
                    row={
                        snap.categoryRows.find((r) => r.id === ledgerCategoryId) ?? {
                            id: ledgerCategoryId,
                            label: ledgerCategoryId,
                            icon: 'folder',
                            used: 0,
                            cap: 0,
                            pay: { pixPaid: 0, cardCommitted: 0, cardInstallmentMonthly: 0 }
                        }
                    }
                    tripRef={{ payload: draft.payload, budgetCaps: draft.budgetCaps }}
                    destinations={destinations}
                    onClose={() => setLedgerCategoryId(null)}
                    onAddExpense={addExpenseInCategory}
                />
            ) : null}
        </section>
    );
}

function CategoryBudgetRow({
    row,
    defaultLabel,
    cap,
    isCustom,
    onCapChange,
    onClear,
    onLabelChange,
    onRemove,
    onCycleIcon,
    onOpen
}: {
    row: {
        id: string;
        label: string;
        icon: string;
        used: number;
        pay: { pixPaid: number; cardCommitted: number; cardInstallmentMonthly: number };
    };
    defaultLabel: string;
    cap: number;
    isCustom?: boolean;
    onCapChange: (n: number) => void;
    onClear: () => void;
    onLabelChange: (label: string) => void;
    onRemove?: () => void;
    onCycleIcon?: () => void;
    onOpen: () => void;
}) {
    const pct = cap > 0 ? Math.min(100, Math.round((row.used / cap) * 100)) : 0;
    const over = cap > 0 && row.used > cap;
    return (
        <li
            className={`orc-cat-row${cap > 0 ? ' has-cap' : ''}${over ? ' is-over' : ''}${isCustom ? ' is-custom' : ''}`}
            data-cat={row.id}
            style={{ '--orc-pct': `${pct}%` } as CSSProperties}
        >
            <div className="orc-cat-row__name-wrap">
                <CategoryNameInput
                    value={row.label}
                    defaultLabel={defaultLabel}
                    onCommit={onLabelChange}
                />
                {onRemove ? (
                    <button
                        type="button"
                        className="orc-cat-row__remove-cat"
                        aria-label={`Excluir categoria ${row.label}`}
                        onClick={onRemove}
                    >
                        <MaterialIcon name="delete" variant="app" opticalSize={14} />
                    </button>
                ) : null}
            </div>
            <button type="button" className="orc-cat-row__hit" onClick={onOpen} aria-label={`Ver gastos de ${row.label}`}>
                {onCycleIcon ? (
                    <button
                        type="button"
                        className="orc-cat-row__chip orc-cat-row__chip--pick"
                        aria-label={`Trocar ícone de ${row.label}`}
                        title="Trocar ícone (voos: avião decolando)"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCycleIcon();
                        }}
                    >
                        <MaterialIcon name={row.icon} variant="app" opticalSize={16} />
                    </button>
                ) : (
                    <span className="orc-cat-row__chip" aria-hidden="true">
                        <MaterialIcon name={row.icon} variant="app" opticalSize={16} />
                    </span>
                )}
                <div className="orc-cat-row__main">
                    <div className="orc-cat-row__meta">
                        <span className="orc-cat-row__spent">
                            {formatBRL(row.used)}
                            {cap > 0 ? <span className="orc-cat-row__of"> · {pct}%</span> : null}
                        </span>
                        <div className="orc-cat-row__pay">
                            <PayMethodChips pay={row.pay} layout="inline" ariaHidden />
                        </div>
                    </div>
                    <div className="orc-cat-row__track" aria-hidden={cap <= 0}>
                        <span className="orc-cat-row__fill" />
                    </div>
                </div>
                <MaterialIcon
                    className="orc-cat-row__chev"
                    name="chevron_right"
                    variant="app"
                    opticalSize={18}
                    aria-hidden
                />
            </button>
            <CategoryCapControl cap={cap} label={row.label} onCapChange={onCapChange} onClear={onClear} />
        </li>
    );
}

function CategoryNameInput({
    value,
    defaultLabel,
    onCommit
}: {
    value: string;
    defaultLabel: string;
    onCommit: (label: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    function commit() {
        const trimmed = draft.trim();
        if (!trimmed) {
            setDraft(value);
            return;
        }
        if (trimmed !== value) onCommit(trimmed);
    }

    return (
        <input
            type="text"
            className="orc-cat-row__name-input"
            value={draft}
            aria-label="Nome da categoria"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                    setDraft(value);
                    e.currentTarget.blur();
                }
            }}
            title={value !== defaultLabel ? `Padrão: ${defaultLabel}` : `Categoria (padrão: ${defaultLabel})`}
        />
    );
}

function CategoryCapControl({
    cap,
    label,
    onCapChange,
    onClear
}: {
    cap: number;
    label: string;
    onCapChange: (n: number) => void;
    onClear: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const cancelEditRef = useRef(false);

    function beginEdit() {
        setEditing(true);
        setDraft(cap > 0 ? String(cap) : '');
    }

    function commitEdit() {
        setEditing(false);
        onCapChange(parseCapInput(draft));
    }

    function handleBlur(e: FocusEvent<HTMLInputElement>) {
        if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest('.orc-cat-row__clear')) return;
        if (cancelEditRef.current) {
            cancelEditRef.current = false;
            setEditing(false);
            return;
        }
        if (!editing) return;
        commitEdit();
    }

    const shown = editing ? draft : cap > 0 ? formatBRL(cap) : '';

    return (
        <div
            className={`orc-cat-row__cap-shell${cap > 0 ? ' has-value' : ''}${editing ? ' is-focus' : ''}`}
        >
            <input
                type="text"
                inputMode="decimal"
                className="orc-cat-row__cap"
                placeholder="Teto"
                aria-label={`Teto ${label}`}
                value={shown}
                onFocus={beginEdit}
                onBlur={handleBlur}
                onChange={(e) => {
                    if (editing) setDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                        cancelEditRef.current = true;
                        e.currentTarget.blur();
                    }
                }}
            />
            {cap > 0 ? (
                <button
                    type="button"
                    className="orc-cat-row__clear"
                    aria-label={`Limpar teto ${label}`}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClear}
                >
                    <MaterialIcon name="close" variant="app" opticalSize={13} />
                </button>
            ) : null}
        </div>
    );
}

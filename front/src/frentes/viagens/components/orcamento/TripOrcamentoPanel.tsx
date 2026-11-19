import { useMemo, useState, type CSSProperties } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { Trip, TripDestination, TripExpense } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { ViagensBackControl } from '../ViagensBackControl';
import type { TripDraft } from '../ViagemFicha';
import {
    buildOrcamentoSnapshot,
    monthShortPt,
    ORCAMENTO_CATEGORIES,
    patchDeposits,
    readDeposits,
    type OrcamentoCategoryId,
    type PiggyDeposit
} from './orcamento-model';
import { PiggyAportePop } from './PiggyAportePop';
import { PiggyHistoryPop } from './PiggyHistoryPop';
import '../../styles/orcamento-workspace.css';

const CATEGORY_CHIP_LABEL: Record<string, string> = Object.fromEntries(
    ORCAMENTO_CATEGORIES.map((c) => [c.id, c.label])
);

function expenseTitle(ex: TripExpense): string {
    return (ex.description ?? (ex as { title?: string }).title ?? 'Lançamento').trim() || 'Lançamento';
}

function parseCapInput(raw: string): number {
    const norm = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!norm) return 0;
    const n = Number(norm);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function expenseDateShort(spentOn?: string): string {
    if (!spentOn?.trim()) return '—';
    const d = new Date(`${spentOn.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return spentOn;
    return d
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
        .replace(/\./g, '');
}

type Props = {
    trip: Trip;
    draft: TripDraft;
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
    onBack: () => void;
};

export function TripOrcamentoPanel({ trip, draft, onPatch, onBack }: Props) {
    const snap = useMemo(() => buildOrcamentoSnapshot(draft), [draft]);
    const [aporteOpen, setAporteOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [metaEdit, setMetaEdit] = useState(false);
    const destinations = draft.payload.destinations ?? [];

    const destName = (id?: string | null) => destinations.find((d) => d.id === id)?.name ?? '';

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

    function addDeposit(amount: number, recordedOn: string) {
        onPatch((d) => {
            const list = readDeposits(d.payload);
            const deposit: PiggyDeposit = {
                id: crypto.randomUUID(),
                amount,
                recordedOn,
                monthKey: recordedOn.slice(0, 7)
            };
            return patchDeposits(d, [...list, deposit]);
        });
    }

    function removeDeposit(id: string) {
        onPatch((d) => {
            const list = readDeposits(d.payload).filter((x) => x.id !== id);
            return patchDeposits(d, list);
        });
    }

    function setExpenses(next: TripExpense[]) {
        onPatch((d) => ({ ...d, payload: { ...d.payload, expenses: next } }));
    }

    function addExpense() {
        const today = new Date().toISOString().slice(0, 10);
        setExpenses([
            ...(draft.payload.expenses ?? []),
            {
                id: crypto.randomUUID(),
                amount: 0,
                category: 'extras',
                description: 'Novo lançamento',
                spentOn: today
            }
        ]);
    }

    const expenses = [...(draft.payload.expenses ?? [])].sort((a, b) =>
        String(b.spentOn ?? '').localeCompare(String(a.spentOn ?? ''))
    );

    return (
        <section className="orc-workspace" aria-label="Orçamento da viagem">
            <header className="orc-workspace__head">
                <ViagensBackControl label="Voltar" onClick={onBack} />
                <OrcamentoHeading trip={trip} />
            </header>

            <div className="orc-kpis">
                <article className="orc-kpi orc-kpi--ouro">
                    <span className="orc-kpi__label">Meta de valor</span>
                    {metaEdit ? (
                        <input
                            type="number"
                            className="orc-kpi__input"
                            min={0}
                            autoFocus
                            defaultValue={snap.goal || ''}
                            onBlur={(e) => {
                                setGoal(Number(e.target.value) || 0);
                                setMetaEdit(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setMetaEdit(false);
                            }}
                        />
                    ) : (
                        <button type="button" className="orc-kpi__value" onClick={() => setMetaEdit(true)}>
                            {formatBRL(snap.goal > 0 ? snap.goal : snap.totalCaps)}
                        </button>
                    )}
                    {snap.goalFromCaps ? (
                        <span className="orc-kpi__hint">Soma dos tetos por categoria</span>
                    ) : snap.goal <= 0 && snap.totalCaps <= 0 ? (
                        <span className="orc-kpi__hint">Meta manual ou tetos nas categorias</span>
                    ) : null}
                </article>

                <article className="orc-kpi orc-kpi--turquesa">
                    <span className="orc-kpi__label">Cofrinho</span>
                    <div className="orc-kpi__row">
                        <strong className="orc-kpi__value">{formatBRL(snap.saved)}</strong>
                        <span className="orc-kpi__tools">
                            <button type="button" aria-label="Histórico de aportes" onClick={() => setHistoryOpen(true)}>
                                <MaterialIcon name="history" variant="app" opticalSize={16} />
                            </button>
                            <button type="button" aria-label="Novo aporte" onClick={() => setAporteOpen(true)}>
                                <MaterialIcon name="add" variant="app" opticalSize={16} />
                            </button>
                        </span>
                    </div>
                    <span className="orc-kpi__hint">
                        {snap.depositCount} {snap.depositCount === 1 ? 'aporte' : 'aportes'}
                    </span>
                </article>

                <article className="orc-kpi orc-kpi--coral">
                    <span className="orc-kpi__label">Falta juntar</span>
                    <strong className="orc-kpi__value">{formatBRL(snap.stillToSave)}</strong>
                </article>

                <article className="orc-kpi orc-kpi--gastos">
                    <span className="orc-kpi__label">Gastos viagem</span>
                    <strong className="orc-kpi__value">{formatBRL(snap.spentTotal)}</strong>
                </article>
            </div>

            <section className="orc-meter orc-meter--spent" aria-label="Orçamento usado">
                <div className="orc-meter__top">
                    <span>Orçamento usado</span>
                    <strong>{snap.effectiveGoal > 0 ? `${snap.spentVsGoalPct}%` : '—'}</strong>
                </div>
                <div className="orc-meter__bar">
                    <span className="orc-meter__fill orc-meter__fill--spent" style={{ width: `${snap.spentVsGoalPct}%` }} />
                </div>
                <p className="orc-meter__caption">
                    <strong>{formatBRL(snap.spentTotal)}</strong>
                    {snap.effectiveGoal > 0 ? ` de ${formatBRL(snap.effectiveGoal)}` : ''}
                </p>
            </section>

            <section className="orc-meter orc-meter--saved" aria-label="Quanto já juntamos">
                <div className="orc-meter__top">
                    <span>Quanto já juntamos</span>
                    <strong>{snap.effectiveGoal > 0 ? `${snap.savedPct}%` : '—'}</strong>
                </div>
                <div className="orc-meter__bar orc-meter__bar--thick">
                    <span className="orc-meter__fill orc-meter__fill--saved" style={{ width: `${snap.savedPct}%` }} />
                </div>
                <div className="orc-pace-grid">
                    <div className="orc-pace-stat">
                        <span>Por mês</span>
                        <strong className="orc-pace-stat--coral">
                            {snap.monthlyNeed != null ? formatBRL(snap.monthlyNeed) : '—'}
                        </strong>
                        {snap.tripMonthLabel ? (
                            <em>até {snap.tripMonthLabel}</em>
                        ) : (
                            <em>{snap.pace.monthsCaption}</em>
                        )}
                    </div>
                    <div className="orc-pace-stat">
                        <span>Meses</span>
                        <strong>{snap.pace.monthsLeft > 0 ? snap.pace.monthsLeft : '—'}</strong>
                        <em>incluindo o da viagem</em>
                    </div>
                    <div className="orc-pace-stat">
                        <span>Ritmo atual</span>
                        <strong className="orc-pace-stat--turquesa">{formatBRL(snap.currentMonthTotal)}</strong>
                        <em>só este mês</em>
                    </div>
                </div>
                {snap.pace.remainingMonthKeys.length > 0 ? (
                    <div className="orc-months" role="list" aria-label="Meses até a viagem">
                        {snap.pace.remainingMonthKeys.map((key) => (
                            <span
                                key={key}
                                className={`orc-months__chip${key === snap.pace.tripMonthKey ? ' is-trip' : ''}`}
                                role="listitem"
                            >
                                {monthShortPt(key)}
                            </span>
                        ))}
                    </div>
                ) : null}
                <p className="orc-insight">
                    <MaterialIcon name="lightbulb" variant="app" opticalSize={16} />
                    {snap.pace.insight}
                </p>
            </section>

            <div className="orc-columns">
                <section className="orc-panel" aria-labelledby="orc-cat-title">
                    <div className="orc-panel__head">
                        <h3 id="orc-cat-title" className="orc-panel__title">
                            Categorias
                        </h3>
                        <span className="orc-cat-head-total" title="Soma dos tetos">
                            {formatBRL(snap.totalCaps)}
                        </span>
                    </div>
                    <ul className="orc-cat-list">
                        {snap.categoryRows.map((row) => (
                            <CategoryBudgetRow
                                key={row.id}
                                row={row}
                                cap={Number(draft.budgetCaps?.[row.id] ?? row.cap) || 0}
                                onCapChange={(v) => setCap(row.id, v)}
                                onClear={() => clearCap(row.id)}
                            />
                        ))}
                    </ul>
                </section>

                <section className="orc-panel" aria-labelledby="orc-exp-title">
                    <div className="orc-panel__head">
                        <h3 id="orc-exp-title" className="orc-panel__title">
                            Lançamentos
                        </h3>
                        <button type="button" className="orc-panel__add" aria-label="Novo lançamento" onClick={addExpense}>
                            <MaterialIcon name="add" variant="app" opticalSize={18} />
                        </button>
                    </div>
                    {expenses.length === 0 ? (
                        <p className="orc-exp-empty">Nenhum gasto lançado ainda.</p>
                    ) : (
                        <ul className="orc-exp-list">
                            {expenses.map((ex) => (
                                <ExpenseRow
                                    key={ex.id}
                                    ex={ex}
                                    destinations={destinations}
                                    destName={destName(ex.destinationId)}
                                    onChange={(next) =>
                                        setExpenses(expenses.map((x) => (x.id === ex.id ? next : x)))
                                    }
                                    onDelete={() => setExpenses(expenses.filter((x) => x.id !== ex.id))}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {aporteOpen ? <PiggyAportePop onClose={() => setAporteOpen(false)} onSave={addDeposit} /> : null}
            {historyOpen ? (
                <PiggyHistoryPop deposits={snap.deposits} onClose={() => setHistoryOpen(false)} onDelete={removeDeposit} />
            ) : null}
        </section>
    );
}

const CAT_ACCENT: Record<string, string> = {
    hospedagem: 'ouro',
    comida: 'coral',
    transporte: 'turquesa',
    passeios: 'oceano',
    extras: 'coral',
    documentos: 'ouro'
};

function CategoryBudgetRow({
    row,
    cap,
    onCapChange,
    onClear
}: {
    row: { id: string; label: string; icon: string; used: number };
    cap: number;
    onCapChange: (n: number) => void;
    onClear: () => void;
}) {
    const pct = cap > 0 ? Math.min(100, Math.round((row.used / cap) * 100)) : 0;
    const over = cap > 0 && row.used > cap;
    const accent = CAT_ACCENT[row.id] ?? 'turquesa';

    return (
        <li
            className={`orc-cat-row orc-cat-row--${accent}${cap > 0 ? ' has-cap' : ''}${over ? ' is-over' : ''}`}
            data-cat={row.id}
            style={{ '--orc-pct': `${pct}%` } as CSSProperties}
        >
            <span className="orc-cat-row__chip" aria-hidden="true">
                <MaterialIcon name={row.icon} variant="app" opticalSize={16} />
            </span>
            <div className="orc-cat-row__main">
                <div className="orc-cat-row__meta">
                    <span className="orc-cat-row__name">{row.label}</span>
                    <span className="orc-cat-row__spent">
                        {formatBRL(row.used)}
                        {cap > 0 ? (
                            <span className="orc-cat-row__of">
                                {' '}
                                · {pct}% · {formatBRL(cap)}
                            </span>
                        ) : null}
                    </span>
                </div>
                <div className="orc-cat-row__track" aria-hidden={cap <= 0}>
                    <span className="orc-cat-row__fill" />
                </div>
            </div>
            <label className="orc-cat-row__cap-wrap">
                <span className="orc-cat-row__cap-label">Teto</span>
                <input
                    type="text"
                    inputMode="decimal"
                    className="orc-cat-row__cap"
                    placeholder="0"
                    aria-label={`Teto ${row.label}`}
                    value={cap > 0 ? String(cap) : ''}
                    onChange={(e) => onCapChange(parseCapInput(e.target.value))}
                />
            </label>
            <button
                type="button"
                className="orc-cat-row__clear"
                aria-label={`Limpar teto ${row.label}`}
                disabled={cap <= 0}
                onClick={onClear}
            >
                <MaterialIcon name="close" variant="app" opticalSize={14} />
            </button>
        </li>
    );
}

function OrcamentoHeading({ trip }: { trip: Trip }) {
    return (
        <div className="orc-workspace__title-block">
            <h2 className="orc-workspace__title">Orçamento</h2>
            <p className="orc-workspace__trip">{trip.title}</p>
        </div>
    );
}

function ExpenseRow({
    ex,
    destinations,
    destName,
    onChange,
    onDelete
}: {
    ex: TripExpense;
    destinations: TripDestination[];
    destName: string;
    onChange: (e: TripExpense) => void;
    onDelete: () => void;
}) {
    const catLabel = ex.customCategoryId
        ? 'Extra'
        : CATEGORY_CHIP_LABEL[ex.category ?? 'extras'] ?? ex.category ?? 'Extras';

    return (
        <li className="orc-exp">
            <input
                className="orc-exp__title"
                value={expenseTitle(ex)}
                onChange={(e) => onChange({ ...ex, description: e.target.value })}
                aria-label="Descrição do lançamento"
            />
            <div className="orc-exp__chips">
                <span className="orc-exp-chip">
                    <MaterialIcon name="event" variant="app" opticalSize={14} />
                    {expenseDateShort(ex.spentOn)}
                </span>
                <span className="orc-exp-chip orc-exp-chip--cat">{catLabel}</span>
                {destName ? (
                    <span className="orc-exp-chip orc-exp-chip--dest">
                        <MaterialIcon name="place" variant="app" opticalSize={14} />
                        {destName}
                    </span>
                ) : null}
            </div>
            <div className="orc-exp__foot">
                <input
                    type="date"
                    className="orc-exp__date"
                    value={ex.spentOn?.slice(0, 10) ?? ''}
                    onChange={(e) => onChange({ ...ex, spentOn: e.target.value })}
                />
                <select
                    className="orc-exp__cat"
                    value={ex.category ?? 'extras'}
                    onChange={(e) => onChange({ ...ex, category: e.target.value as OrcamentoCategoryId })}
                >
                    {ORCAMENTO_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.label}
                        </option>
                    ))}
                </select>
                <select
                    className="orc-exp__dest"
                    value={ex.destinationId ?? ''}
                    onChange={(e) => onChange({ ...ex, destinationId: e.target.value || null })}
                >
                    <option value="">Sem destino</option>
                    {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="orc-exp__side">
                <input
                    type="number"
                    className="orc-exp__amount"
                    min={0}
                    step={0.01}
                    value={ex.amount ?? ''}
                    onChange={(e) => onChange({ ...ex, amount: Number(e.target.value) || 0 })}
                    aria-label="Valor"
                />
                <button type="button" className="orc-exp__del" aria-label="Excluir lançamento" onClick={onDelete}>
                    <MaterialIcon name="delete" variant="app" opticalSize={16} />
                </button>
            </div>
        </li>
    );
}
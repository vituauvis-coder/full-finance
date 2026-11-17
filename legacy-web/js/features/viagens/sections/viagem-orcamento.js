import { formatBRL } from '../map-utils.js';
import { spent, capFor, budgets, EXPENSE_CATEGORIES } from '../../../../../motor/viagens/trips-engine.js';

export function renderOrcamentoSection(draft) {
    const caps = draft.budgetCaps ?? {};
    const payload = draft.payload ?? {};
    const custom = payload.budget_custom_categories ?? payload.budgetCustomCategories ?? [];
    const goal = Number(payload.tripGoal ?? payload.trip_goal ?? 0);
    const piggy = Number(payload.piggyBank ?? payload.piggy_bank ?? 0);
    const totalSpent = spent({ payload: draft.payload, budgetCaps: caps });
    const rows = budgets({ payload: draft.payload, budgetCaps: caps });

    return `
        <details class="viagens-secao">
            <summary class="viagens-secao__head"><span class="viagens-secao__dot viagens-secao__dot--ouro"></span> Orçamento</summary>
            <div class="viagens-secao__body">
                <div class="viagens-kpi-grid">
                    <div class="viagens-kpi"><span>Meta de valor</span><strong>${formatBRL(goal)}</strong></div>
                    <div class="viagens-kpi"><span>Cofrinho</span><strong class="viagens-kpi--turquesa">${formatBRL(piggy)}</strong></div>
                    <div class="viagens-kpi"><span>Falta juntar</span><strong class="viagens-kpi--coral">${formatBRL(Math.max(0, goal - piggy))}</strong></div>
                    <div class="viagens-kpi"><span>Gastos viagem</span><strong>${formatBRL(totalSpent)}</strong></div>
                </div>
                <div class="viagens-field-row">
                    <label>Meta (R$)</label>
                    <input type="number" class="viagens-field" data-orc-meta min="0" value="${goal || ''}">
                    <label>Cofrinho (R$)</label>
                    <input type="number" class="viagens-field" data-orc-piggy min="0" value="${piggy || ''}">
                </div>
                <h4 class="viagens-subtitle">Categorias</h4>
                ${EXPENSE_CATEGORIES.map((cat) => {
                    const cap = capFor({ budgetCaps: caps }, cat);
                    const used = spent({ payload: draft.payload, budgetCaps: caps }, { category: cat });
                    const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                    return `
                    <div class="viagens-field-row">
                        <label>${cat}</label>
                        <input type="number" class="viagens-field" data-cap-cat="${cat}" min="0" value="${cap || ''}">
                        <span class="viagens-muted">${formatBRL(used)} / ${formatBRL(cap)}</span>
                        <div class="viagens-cap-bar"><div class="viagens-cap-bar__fill" style="width:${pct}%"></div></div>
                    </div>`;
                }).join('')}
                ${custom.map((c) => `<div class="viagens-muted">+ ${escapeHtml(c.name || c.id)}</div>`).join('')}
                <h4 class="viagens-subtitle">Lançamentos</h4>
                <div data-expense-list>
                    ${(payload.expenses ?? [])
                        .map(
                            (e) => `
                        <div class="viagens-list-item" data-expense-id="${e.id}">
                            <input class="viagens-field" data-exp-title value="${escapeHtml(e.title)}" placeholder="Descrição">
                            <input type="number" class="viagens-field" data-exp-amount min="0" step="0.01" value="${e.amount ?? ''}">
                            <input type="date" class="viagens-field" data-exp-date value="${e.date ?? ''}">
                            <select class="viagens-field" data-exp-cat>
                                ${EXPENSE_CATEGORIES.map((c) => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                            <button type="button" class="viagens-btn viagens-btn--ghost" data-exp-del>✕</button>
                        </div>`
                        )
                        .join('')}
                </div>
                <button type="button" class="viagens-btn viagens-btn--ghost" data-add-expense>+ Lançamento</button>
            </div>
        </details>`;
}

export function bindOrcamentoSection(root, { getDraft, patchDraft, scheduleSave }) {
    root.querySelector('[data-orc-meta]')?.addEventListener('change', (e) => {
        const v = Number(e.target.value) || 0;
        patchDraft((d) => ({
            ...d,
            payload: { ...d.payload, tripGoal: v, trip_goal: v }
        }));
        scheduleSave();
    });
    root.querySelector('[data-orc-piggy]')?.addEventListener('change', (e) => {
        const v = Number(e.target.value) || 0;
        patchDraft((d) => ({
            ...d,
            payload: { ...d.payload, piggyBank: v, piggy_bank: v }
        }));
        scheduleSave();
    });
    root.querySelectorAll('[data-cap-cat]').forEach((input) => {
        input.addEventListener('change', () => {
            const cat = input.dataset.capCat;
            patchDraft((d) => ({
                ...d,
                budgetCaps: { ...d.budgetCaps, [cat]: Number(input.value) || 0 }
            }));
            scheduleSave();
        });
    });
    root.querySelector('[data-add-expense]')?.addEventListener('click', () => {
        patchDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                expenses: [
                    ...(d.payload.expenses ?? []),
                    {
                        id: crypto.randomUUID(),
                        title: 'Novo',
                        amount: 0,
                        date: new Date().toISOString().slice(0, 10),
                        category: 'extras'
                    }
                ]
            }
        }));
        scheduleSave();
        root.dispatchEvent(new CustomEvent('viagens:rerender'));
    });
    root.querySelectorAll('[data-expense-id]').forEach((row) => {
        const sync = () => {
            const id = row.dataset.expenseId;
            const title = row.querySelector('[data-exp-title]')?.value;
            const amount = Number(row.querySelector('[data-exp-amount]')?.value) || 0;
            const date = row.querySelector('[data-exp-date]')?.value;
            const category = row.querySelector('[data-exp-cat]')?.value;
            patchDraft((d) => ({
                ...d,
                payload: {
                    ...d.payload,
                    expenses: (d.payload.expenses ?? []).map((ex) =>
                        ex.id === id ? { ...ex, title, amount, date, category } : ex
                    )
                }
            }));
            scheduleSave();
        };
        row.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', sync));
        row.querySelector('[data-exp-del]')?.addEventListener('click', () => {
            const id = row.dataset.expenseId;
            patchDraft((d) => ({
                ...d,
                payload: {
                    ...d.payload,
                    expenses: (d.payload.expenses ?? []).filter((ex) => ex.id !== id)
                }
            }));
            scheduleSave();
            root.dispatchEvent(new CustomEvent('viagens:rerender'));
        });
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
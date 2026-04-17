import { openModal, closeModal, showToast } from '../../shell/app-shell.js';
import { formatCurrency, movementDateToJsDate } from '../../core/utils.js';
import { saveDebt, saveDebtUpdate, deleteDebtUpdate } from '../../services/firestore.js';

let debtsCache = null;
let debtUpdatesCache = null;
let currencyCache = 'BRL';
let debtsChart = null;

/** Máximo de linhas mensais no formulário (intervalos muito longos são truncados). */
const DEBT_FORM_MONTH_CAP = 120;

function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function enumerateMonths(minDate, maxDate) {
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const out = [];
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
        out.push(new Date(y, m, 1));
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return out;
}

/** Rótulo tipo "Janeiro 26" */
function formatDebtMonthLabel(d) {
    const month = d.toLocaleDateString('pt-BR', { month: 'long' });
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const cap = month.charAt(0).toUpperCase() + month.slice(1);
    return `${cap} ${yy}`;
}

/**
 * Meses do primeiro mês da dívida até o mês atual (ou 12 meses se o início for no futuro).
 * Se passar de DEBT_FORM_MONTH_CAP, trunca os primeiros meses e mantém os mais recentes.
 */
function buildMonthsForDebtForm(startDateStr) {
    if (!startDateStr || String(startDateStr).trim() === '') {
        return { months: [], truncated: false, note: '' };
    }
    const parts = String(startDateStr).split('-').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return { months: [], truncated: false, note: '' };
    }
    const start = new Date(parts[0], parts[1] - 1, 1);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let from = start;
    let to;
    if (start.getTime() > currentMonthStart.getTime()) {
        to = new Date(start.getFullYear(), start.getMonth() + 11, 1);
    } else {
        to = currentMonthStart;
    }

    let months = enumerateMonths(from, to);
    let truncated = false;
    let note = '';
    if (months.length > DEBT_FORM_MONTH_CAP) {
        truncated = true;
        note = `São ${months.length} meses neste intervalo. Mostrando os últimos ${DEBT_FORM_MONTH_CAP} meses (até o mês atual). Para meses mais antigos, ajuste a data de início.`;
        months = months.slice(-DEBT_FORM_MONTH_CAP);
    }
    return { months, truncated, note };
}

function renderDebtMonthRows(months) {
    const wrap = document.getElementById('debt-monthly-rows');
    if (!wrap) return;
    wrap.innerHTML = '';

    months.forEach((d) => {
        const key = monthKey(d);
        const id = `debt-m-${key}`;
        const row = document.createElement('div');
        row.className = 'form-group debt-month-row';
        row.dataset.monthKey = key;
        row.innerHTML = `
            <div class="debt-month-row__inner">
                <label class="debt-month-row__label" for="${id}">${formatDebtMonthLabel(d)}</label>
                <div class="debt-month-row__controls">
                    <input type="number" class="debt-month-input" id="${id}" data-month-key="${key}"
                        step="0.01" min="0" placeholder="Valor (R$)" inputmode="decimal" autocomplete="off" />
                    <button type="button" class="btn-icon debt-month-remove" title="Remover este mês" aria-label="Remover este mês">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `;
        wrap.appendChild(row);
    });
}

function syncDebtMonthlySectionFromStartDate() {
    const startInput = document.getElementById('debt-start-date');
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    if (!startInput || !section || !noteEl) return;

    const val = startInput.value;
    const { months, note } = buildMonthsForDebtForm(val);

    if (months.length === 0) {
        section.classList.add('hidden');
        document.getElementById('debt-monthly-rows') && (document.getElementById('debt-monthly-rows').innerHTML = '');
        noteEl.classList.add('hidden');
        noteEl.textContent = '';
        return;
    }

    section.classList.remove('hidden');
    renderDebtMonthRows(months);
    if (note) {
        noteEl.textContent = note;
        noteEl.classList.remove('hidden');
    } else {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
}

function resetDebtForm() {
    const form = document.getElementById('debt-update-form');
    if (form) form.reset();
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    const rows = document.getElementById('debt-monthly-rows');
    if (section) section.classList.add('hidden');
    if (noteEl) {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
    if (rows) rows.innerHTML = '';
}

function getOrCreateDebtByCompany(company, debts, userId) {
    const norm = String(company || '').trim().toLowerCase();
    const found = (debts || []).find((d) => String(d.company || '').trim().toLowerCase() === norm);
    if (found) return found;
    return { id: null, userId, company: String(company || '').trim(), isClosed: false, notes: null };
}

function monthKeyToReferenceDate(key) {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return new Date();
    return new Date(y, m - 1, 1, 12, 0, 0);
}

function renderDebtUpdatesTable(debts, updates, currency) {
    const tbody = document.getElementById('debt-updates-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const debtById = new Map((debts || []).map((d) => [d.id, d]));
    const rows = (updates || []).slice().sort((a, b) => movementDateToJsDate(b.date) - movementDateToJsDate(a.date));
    if (rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center; opacity:0.8;">Nenhuma atualização cadastrada.</td>`;
        tbody.appendChild(tr);
        return;
    }

    rows.forEach((u) => {
        const d = movementDateToJsDate(u.date);
        const debt = debtById.get(u.debtId);
        const company = debt?.company || '—';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.toLocaleDateString('pt-BR')}</td>
            <td>${company}</td>
            <td>${formatCurrency(Number(u.amount) || 0, currency)}</td>
            <td>
                <div class="debt-actions">
                    <button type="button" class="btn-icon debt-delete-update" title="Excluir" data-id="${u.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function buildDebtsChart(debts, updates, currency) {
    const canvas = document.getElementById('debts-chart');
    if (!canvas) return;

    const uList = (updates || []).slice();
    if (uList.length === 0) {
        if (debtsChart) debtsChart.destroy();
        debtsChart = null;
        return;
    }

    const dates = uList.map((u) => movementDateToJsDate(u.date)).filter((d) => !Number.isNaN(d.getTime()));
    const minD = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxD = new Date(Math.max(...dates.map((d) => d.getTime())));
    const months = enumerateMonths(minD, maxD);
    const labels = months.map((m) => m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    const monthKeys = months.map((m) => monthKey(m));

    const debtById = new Map((debts || []).map((d) => [d.id, d]));
    const byDebt = new Map();
    uList.forEach((u) => {
        if (!byDebt.has(u.debtId)) byDebt.set(u.debtId, []);
        byDebt.get(u.debtId).push(u);
    });
    byDebt.forEach((arr) => arr.sort((a, b) => movementDateToJsDate(a.date) - movementDateToJsDate(b.date)));

    const palette = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#eab308'];
    let colorIdx = 0;

    const datasets = [...byDebt.entries()].map(([debtId, arr]) => {
        const company = debtById.get(debtId)?.company || 'Dívida';
        const lastByMonth = new Map();
        arr.forEach((u) => {
            const d = movementDateToJsDate(u.date);
            const mk = monthKey(d);
            lastByMonth.set(mk, Number(u.amount) || 0);
        });
        const data = monthKeys.map((mk) => (lastByMonth.has(mk) ? lastByMonth.get(mk) : null));
        const color = palette[colorIdx++ % palette.length];
        return {
            label: company,
            data,
            borderColor: color,
            backgroundColor: 'transparent',
            tension: 0.2,
            spanGaps: true
        };
    });

    if (debtsChart) debtsChart.destroy();
    debtsChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, currency)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatCurrency(v, currency) }
                }
            }
        }
    });
}

function refreshDebtsUI() {
    renderDebtUpdatesTable(debtsCache, debtUpdatesCache, currencyCache);
    buildDebtsChart(debtsCache, debtUpdatesCache, currencyCache);
}

function collectDebtFormMonthAmounts() {
    const inputs = document.querySelectorAll('#debt-monthly-rows .debt-month-input');
    const out = [];
    inputs.forEach((inp) => {
        const raw = String(inp.value ?? '').trim();
        if (raw === '') return;
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n)) return;
        const key = inp.dataset.monthKey;
        if (!key) return;
        out.push({ monthKey: key, amount: n, date: monthKeyToReferenceDate(key) });
    });
    return out;
}

function bindDebtsEvents(currentUser, onDataRefresh) {
    document.getElementById('add-debt-update-btn')?.addEventListener('click', () => {
        resetDebtForm();
        openModal('debt-update-modal');
    });

    document.querySelectorAll('[data-close-modal="debt-update-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('debt-update-modal'));
    });

    const startDateEl = document.getElementById('debt-start-date');
    startDateEl?.addEventListener('change', () => syncDebtMonthlySectionFromStartDate());
    startDateEl?.addEventListener('input', () => syncDebtMonthlySectionFromStartDate());

    const debtForm = document.getElementById('debt-update-form');
    debtForm?.addEventListener('click', (e) => {
        const rm = e.target.closest('.debt-month-remove');
        if (!rm) return;
        const row = rm.closest('.debt-month-row');
        row?.remove();
    });

    debtForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const company = String(form['debt-company']?.value || '').trim();
        const startStr = String(form['debt-start-date']?.value || '').trim();
        if (!company || !startStr) {
            showToast('Preencha o nome e a data de início.');
            return;
        }

        const entries = collectDebtFormMonthAmounts();
        if (entries.length === 0) {
            showToast('Preencha o valor em pelo menos um mês (ou ajuste a data de início).');
            return;
        }

        try {
            const debt = getOrCreateDebtByCompany(company, debtsCache, currentUser.uid);
            let debtId = debt.id;
            if (!debtId) {
                const created = await saveDebt({ userId: currentUser.uid, company, notes: null, isClosed: false });
                debtId = created.id;
            }
            for (const { date, amount } of entries) {
                await saveDebtUpdate({
                    userId: currentUser.uid,
                    debtId,
                    date: date.toISOString(),
                    amount,
                    description: null
                });
            }
            closeModal('debt-update-modal');
            showToast(entries.length === 1 ? 'Dívida salva.' : `Dívida salva (${entries.length} meses).`);
            await onDataRefresh?.();
        } catch (err) {
            console.error(err);
            showToast('Erro ao salvar.');
        }
    });

    document.getElementById('debt-updates-tbody')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.debt-delete-update');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;
        try {
            await deleteDebtUpdate(id);
            showToast('Atualização excluída.');
            await onDataRefresh?.();
        } catch (err) {
            console.error(err);
            showToast('Erro ao excluir.');
        }
    });
}

export function initDebts(currentUser, onDataRefresh) {
    if (initDebts._bound) return;
    initDebts._bound = true;
    bindDebtsEvents(currentUser, onDataRefresh);
}

export function loadDebtsData(userDebts, userDebtUpdates, currency = 'BRL') {
    debtsCache = userDebts || [];
    debtUpdatesCache = userDebtUpdates || [];
    currencyCache = currency || 'BRL';
    refreshDebtsUI();
}

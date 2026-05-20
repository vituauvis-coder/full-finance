import { openModal, closeModal, showToast } from '../../shell/app-shell.js';
import { saveDebt, saveDebtUpdate } from '../../services/firestore.js';
import {
    runWithButtonLoading,
    setFormSubmittingState
} from '../../core/button-loading.js';
import { monthKey } from './debts-aggregations.js';
import {
    buildMonthsForDebtForm,
    DEBT_START_MONTH_OPTIONS,
    debtStartYearRange,
    formatDebtMonthShortLabel,
    groupMonthsByYear,
    indexUpdatesByMonthKey,
    previousFilledAmount,
    countFilledMonths
} from './debt-form-months.js';
import { mountDebtSettingsColorSwatches } from './debt-cards.js';

let debtsCache = null;
let debtUpdatesCache = null;
let currencyCache = 'BRL';

/** Valores digitados: monthKey → string */
let debtFormValues = new Map();
/** Updates existentes: monthKey → update id */
let debtFormUpdateByMonth = new Map();
let debtFormCompanyLocked = false;

function escapeAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function syncDebtFormValuesFromDom() {
    document.querySelectorAll('#debt-monthly-years .debt-month-input').forEach((inp) => {
        const key = inp.dataset.monthKey;
        if (!key) return;
        debtFormValues.set(key, inp.value);
    });
}

function initDebtStartMonthSelectors() {
    const monthEl = document.getElementById('debt-start-month');
    const yearEl = document.getElementById('debt-start-year');
    if (!monthEl || !yearEl || monthEl.dataset.populated === '1') return;
    monthEl.dataset.populated = '1';
    monthEl.innerHTML =
        '<option value="">Mês</option>' +
        DEBT_START_MONTH_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    const { min, max } = debtStartYearRange();
    const yearOpts = [];
    for (let y = max; y >= min; y--) {
        yearOpts.push(`<option value="${y}">${y}</option>`);
    }
    yearEl.innerHTML = '<option value="">Ano</option>' + yearOpts.join('');
}

function syncDebtStartDateFromSelects() {
    const hidden = document.getElementById('debt-start-date');
    const m = document.getElementById('debt-start-month')?.value || '';
    const y = document.getElementById('debt-start-year')?.value || '';
    if (hidden) hidden.value = m && y ? `${y}-${m}` : '';
}

function setDebtStartDateValue(yyyyMm) {
    const monthEl = document.getElementById('debt-start-month');
    const yearEl = document.getElementById('debt-start-year');
    const hidden = document.getElementById('debt-start-date');
    if (!yyyyMm) {
        if (monthEl) monthEl.value = '';
        if (yearEl) yearEl.value = '';
        if (hidden) hidden.value = '';
        return;
    }
    const parts = String(yyyyMm).split('-');
    const y = parts[0] || '';
    const m = (parts[1] || '').padStart(2, '0');
    if (monthEl && m) monthEl.value = m;
    if (yearEl && y) yearEl.value = y;
    if (hidden && y && m) hidden.value = `${y}-${m}`;
}

function getDebtStartDateValue() {
    syncDebtStartDateFromSelects();
    return document.getElementById('debt-start-date')?.value?.trim() || '';
}

function onDebtStartSelectChange() {
    syncDebtStartDateFromSelects();
    syncDebtMonthlySectionFromStartDate();
}

function getDebtFormMonthKeysInOrder() {
    const startStr = getDebtStartDateValue();
    const { months } = buildMonthsForDebtForm(startStr);
    return months.map((d) => monthKey(d));
}

function updateDebtMonthFilledCount() {
    const el = document.getElementById('debt-month-filled-count');
    if (!el) return;
    const n = countFilledMonths(debtFormValues);
    el.textContent = n === 0 ? '' : `${n} ${n === 1 ? 'mês' : 'meses'}`;
}

function renderDebtMonthlyYears(months, { expandYear = null } = {}) {
    const wrap = document.getElementById('debt-monthly-years');
    if (!wrap) return;
    const groups = groupMonthsByYear(months);
    const currentYear = new Date().getFullYear();

    wrap.innerHTML = groups
        .map(({ year, months: yearMonths }) => {
            const expanded = expandYear != null ? year === expandYear : year === currentYear;
            const filledInYear = yearMonths.filter((d) => {
                const v = debtFormValues.get(monthKey(d));
                return v != null && String(v).trim() !== '';
            }).length;
            const cells = yearMonths
                .map((d) => {
                    const key = monthKey(d);
                    const val = debtFormValues.get(key) ?? '';
                    const label = formatDebtMonthShortLabel(d);
                    const valAttr = val === '' ? '' : escapeAttr(String(val));
                    const filled =
                        val != null && String(val).trim() !== '' ? ' debt-month-cell--filled' : '';
                    return `<div class="debt-month-cell${filled}" data-month-key="${escapeAttr(key)}">
                        <div class="debt-month-cell__head">
                            <span class="debt-month-cell__label">${label}</span>
                            <div class="debt-month-cell__tools">
                                <button type="button" class="debt-month-cell__tool debt-month-copy-prev"
                                    data-month-key="${escapeAttr(key)}"
                                    title="Igual ao mês anterior" aria-label="Igual ao mês anterior ${label}">
                                    <i class="fas fa-arrow-down" aria-hidden="true"></i>
                                </button>
                                <button type="button" class="debt-month-cell__tool debt-month-clear"
                                    data-month-key="${escapeAttr(key)}"
                                    title="Limpar" aria-label="Limpar ${label}">
                                    <i class="fas fa-eraser" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <input type="number" class="debt-month-input" data-month-key="${escapeAttr(key)}"
                            step="0.01" min="0" placeholder="0,00" inputmode="decimal"
                            autocomplete="off" value="${valAttr}" aria-label="Valor em ${label}" />
                    </div>`;
                })
                .join('');
            return `<section class="debt-year-block" data-year="${year}">
                <button type="button" class="debt-year-block__toggle" aria-expanded="${expanded}"
                    data-year-toggle="${year}">
                    <span class="debt-year-block__year">${year}</span>
                    <span class="debt-year-block__meta">${filledInYear} de ${yearMonths.length} preenchido${filledInYear === 1 ? '' : 's'}</span>
                </button>
                <div class="debt-year-block__panel" ${expanded ? '' : 'hidden'} data-year-panel="${year}">
                    <div class="debt-month-grid" role="list">${cells}</div>
                </div>
            </section>`;
        })
        .join('');

    updateDebtMonthFilledCount();
}

function syncDebtMonthlySectionFromStartDate(expandYear = null) {
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    if (!section || !noteEl) return;

    syncDebtStartDateFromSelects();
    syncDebtFormValuesFromDom();

    const val = getDebtStartDateValue();
    const { months, note } = buildMonthsForDebtForm(val);

    if (months.length === 0) {
        section.classList.add('hidden');
        const wrap = document.getElementById('debt-monthly-years');
        if (wrap) wrap.innerHTML = '';
        noteEl.classList.add('hidden');
        noteEl.textContent = '';
        updateDebtMonthFilledCount();
        return;
    }

    section.classList.remove('hidden');
    renderDebtMonthlyYears(months, { expandYear });
    if (note) {
        noteEl.textContent = note;
        noteEl.classList.remove('hidden');
    } else {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
}

function seedDebtFormFromDebt(debt) {
    if (!debt?.id) return;
    const byMonth = indexUpdatesByMonthKey(debtUpdatesCache, debt.id);
    debtFormUpdateByMonth = new Map();
    debtFormValues = new Map();
    byMonth.forEach((u, mk) => {
        debtFormUpdateByMonth.set(mk, u.id);
        debtFormValues.set(mk, String(Number(u.amount) || 0));
    });
    const dates = [...byMonth.keys()].sort();
    if (dates.length) setDebtStartDateValue(dates[0]);
}

function resetDebtForm() {
    const form = document.getElementById('debt-update-form');
    if (form) form.reset();
    debtFormValues = new Map();
    debtFormUpdateByMonth = new Map();
    debtFormCompanyLocked = false;
    const companyInput = document.getElementById('debt-company');
    if (companyInput) {
        companyInput.readOnly = false;
        companyInput.removeAttribute('aria-readonly');
    }
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    const wrap = document.getElementById('debt-monthly-years');
    if (section) section.classList.add('hidden');
    if (noteEl) {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
    if (wrap) wrap.innerHTML = '';
    setDebtStartDateValue('');
    updateDebtMonthFilledCount();
}

function getOrCreateDebtByCompany(company, debts, userId) {
    const norm = String(company || '').trim().toLowerCase();
    const found = (debts || []).find((d) => String(d.company || '').trim().toLowerCase() === norm);
    if (found) return found;
    return {
        id: null,
        userId,
        company: String(company || '').trim(),
        isClosed: false,
        notes: null,
        colorKey: 'wine',
        initialAmount: null,
        lastOfferDiscountPercent: null
    };
}

export function getDebtsCaches() {
    return { debtsCache, debtUpdatesCache, currencyCache };
}

export function openRegisterForDebt(debtId) {
    const debt = (debtsCache || []).find((d) => d.id === debtId);
    resetDebtForm();
    const companyInput = document.getElementById('debt-company');
    if (companyInput && debt) {
        companyInput.value = debt.company || '';
        companyInput.readOnly = true;
        companyInput.setAttribute('aria-readonly', 'true');
        debtFormCompanyLocked = true;
        seedDebtFormFromDebt(debt);
    }
    const currentYear = new Date().getFullYear();
    syncDebtMonthlySectionFromStartDate(currentYear);
    openModal('debt-update-modal');
    requestAnimationFrame(() => {
        const mk = monthKey(new Date());
        document.querySelector(`#debt-monthly-years .debt-month-input[data-month-key="${mk}"]`)?.focus();
    });
}

function resetDebtSettingsForm() {
    const form = document.getElementById('debt-settings-form');
    if (form) form.reset();
}

export function openSettingsForDebt(debtId) {
    const debt = (debtsCache || []).find((d) => d.id === debtId);
    if (!debt) {
        showToast('Dívida não encontrada.');
        return;
    }
    document.getElementById('debt-settings-id').value = debt.id;
    document.getElementById('debt-settings-company').value = debt.company || '';
    document.getElementById('debt-settings-initial').value =
        debt.initialAmount != null && Number.isFinite(Number(debt.initialAmount))
            ? String(debt.initialAmount)
            : '';

    mountDebtSettingsColorSwatches(debt.colorKey || 'wine');
    document.getElementById('debt-settings-modal-title').textContent = `Definições — ${debt.company}`;
    openModal('debt-settings-modal');
}

function monthKeyToReferenceDate(key) {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return new Date();
    return new Date(y, m - 1, 1, 12, 0, 0);
}

function collectDebtFormMonthAmounts() {
    syncDebtFormValuesFromDom();
    const order = getDebtFormMonthKeysInOrder();
    const out = [];
    order.forEach((key) => {
        const raw = String(debtFormValues.get(key) ?? '').trim();
        if (raw === '') return;
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n)) return;
        out.push({ monthKey: key, amount: n, date: monthKeyToReferenceDate(key) });
    });
    return out;
}

export function setDebtsCaches(debts, updates, currency) {
    debtsCache = debts || [];
    debtUpdatesCache = updates || [];
    currencyCache = currency || 'BRL';
}

function bindDebtsEvents(currentUser, onDataRefresh, onLocalRefresh) {
    document.getElementById('add-debt-update-btn')?.addEventListener('click', () => {
        resetDebtForm();
        openModal('debt-update-modal');
    });

    document.querySelectorAll('[data-close-modal="debt-update-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('debt-update-modal'));
    });

    document.querySelectorAll('[data-close-modal="debt-settings-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            resetDebtSettingsForm();
            closeModal('debt-settings-modal');
        });
    });

    const settingsForm = document.getElementById('debt-settings-form');
    settingsForm?.addEventListener('click', (e) => {
        const colorBtn = e.target.closest('[data-debt-form-color]');
        if (!colorBtn) return;
        const key = colorBtn.getAttribute('data-debt-form-color');
        const hidden = document.getElementById('debt-settings-color');
        if (hidden) hidden.value = key;
        mountDebtSettingsColorSwatches(key);
    });

    settingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const debtId = String(form['debt-settings-id']?.value || '').trim();
        const company = String(form['debt-settings-company']?.value || '').trim();
        const initialRaw = String(form['debt-settings-initial']?.value ?? '').trim();
        const colorKey = String(form['debt-settings-color']?.value || 'wine').trim();

        if (!debtId || !company) {
            showToast('Informe o nome do banco.');
            return;
        }

        let initialAmount = initialRaw === '' ? null : Number(initialRaw.replace(',', '.'));
        if (initialAmount != null && (!Number.isFinite(initialAmount) || initialAmount < 0)) {
            showToast('Valor inicial inválido.');
            return;
        }

        const debt = debtsCache.find((d) => d.id === debtId);
        if (!debt) return;

        setFormSubmittingState(form, true, 'Salvando...');
        try {
            const saved = await saveDebt(
                {
                    userId: currentUser.uid,
                    company,
                    notes: debt.notes,
                    isClosed: debt.isClosed,
                    colorKey,
                    initialAmount,
                    lastOfferDiscountPercent: debt.lastOfferDiscountPercent ?? null
                },
                debtId
            );
            const idx = debtsCache.findIndex((d) => d.id === debtId);
            if (idx >= 0) debtsCache[idx] = { ...debtsCache[idx], ...saved };
            onLocalRefresh?.(debtsCache, debtUpdatesCache, currencyCache);
            closeModal('debt-settings-modal');
            resetDebtSettingsForm();
            showToast('Definições salvas.');
            await onDataRefresh?.();
        } catch (err) {
            console.error(err);
            showToast('Erro ao salvar definições.');
        } finally {
            setFormSubmittingState(form, false);
        }
    });

    initDebtStartMonthSelectors();
    document.getElementById('debt-start-month')?.addEventListener('change', onDebtStartSelectChange);
    document.getElementById('debt-start-year')?.addEventListener('change', onDebtStartSelectChange);

    const companyInput = document.getElementById('debt-company');
    const onCompanyInput = () => {
        if (debtFormCompanyLocked) return;
        const name = String(companyInput?.value || '').trim();
        if (!name) return;
        const found = (debtsCache || []).find(
            (d) => String(d.company || '').trim().toLowerCase() === name.toLowerCase()
        );
        if (found?.id) seedDebtFormFromDebt(found);
        syncDebtMonthlySectionFromStartDate();
    };
    companyInput?.addEventListener('change', onCompanyInput);
    companyInput?.addEventListener('blur', onCompanyInput);

    const debtForm = document.getElementById('debt-update-form');
    debtForm?.addEventListener('click', (e) => {
        const yearToggle = e.target.closest('[data-year-toggle]');
        if (yearToggle) {
            const year = yearToggle.dataset.yearToggle;
            const panel = document.querySelector(`[data-year-panel="${year}"]`);
            if (!panel) return;
            const open = panel.hidden;
            panel.hidden = !open;
            yearToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            return;
        }

        const copyBtn = e.target.closest('.debt-month-copy-prev');
        if (copyBtn?.dataset.monthKey) {
            e.preventDefault();
            syncDebtFormValuesFromDom();
            const key = copyBtn.dataset.monthKey;
            const order = getDebtFormMonthKeysInOrder();
            const prev = previousFilledAmount(order, debtFormValues, key);
            if (prev == null) return;
            debtFormValues.set(key, String(prev));
            const inp = document.querySelector(
                `#debt-monthly-years .debt-month-input[data-month-key="${key}"]`
            );
            if (inp) {
                inp.value = String(prev);
                inp.closest('.debt-month-cell')?.classList.add('debt-month-cell--filled');
            }
            updateDebtMonthFilledCount();
            return;
        }

        const clearBtn = e.target.closest('.debt-month-clear');
        if (clearBtn?.dataset.monthKey) {
            e.preventDefault();
            const key = clearBtn.dataset.monthKey;
            debtFormValues.set(key, '');
            const inp = document.querySelector(
                `#debt-monthly-years .debt-month-input[data-month-key="${key}"]`
            );
            if (inp) {
                inp.value = '';
                inp.closest('.debt-month-cell')?.classList.remove('debt-month-cell--filled');
            }
            updateDebtMonthFilledCount();
        }
    });

    debtForm?.addEventListener('input', (e) => {
        if (!e.target.classList.contains('debt-month-input')) return;
        const key = e.target.dataset.monthKey;
        if (key) debtFormValues.set(key, e.target.value);
        const cell = e.target.closest('.debt-month-cell');
        if (cell) {
            const hasVal = String(e.target.value ?? '').trim() !== '';
            cell.classList.toggle('debt-month-cell--filled', hasVal);
        }
        updateDebtMonthFilledCount();
    });

    debtForm?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.classList.contains('debt-month-input')) return;
        e.preventDefault();
        const inputs = [...document.querySelectorAll('#debt-monthly-years .debt-month-input')];
        const i = inputs.indexOf(e.target);
        if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus();
    });

    debtForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const company = String(form['debt-company']?.value || '').trim();
        syncDebtStartDateFromSelects();
        const startStr = getDebtStartDateValue();
        if (!company || !startStr) {
            showToast('Selecione o mês e o ano de início.');
            return;
        }

        const entries = collectDebtFormMonthAmounts();
        if (entries.length === 0) {
            showToast('Preencha o valor em pelo menos um mês (ou ajuste a data de início).');
            return;
        }

        setFormSubmittingState(form, true, 'Salvando dívida...');
        try {
            const debt = getOrCreateDebtByCompany(company, debtsCache, currentUser.uid);
            let debtId = debt.id;
            const sortedEntries = entries.slice().sort((a, b) => a.date - b.date);
            const firstAmount = sortedEntries[0]?.amount;
            if (!debtId) {
                const created = await saveDebt({
                    userId: currentUser.uid,
                    company,
                    notes: null,
                    isClosed: false,
                    colorKey: 'wine',
                    initialAmount: firstAmount ?? null,
                    lastOfferDiscountPercent: null
                });
                debtId = created.id;
                debtsCache.push(created);
            } else if (debt.initialAmount == null && firstAmount != null) {
                const updated = await saveDebt(
                    {
                        userId: currentUser.uid,
                        company: debt.company,
                        notes: debt.notes,
                        isClosed: debt.isClosed,
                        colorKey: debt.colorKey || 'wine',
                        initialAmount: firstAmount,
                        lastOfferDiscountPercent: debt.lastOfferDiscountPercent
                    },
                    debtId
                );
                const idx = debtsCache.findIndex((d) => d.id === debtId);
                if (idx >= 0) debtsCache[idx] = { ...debtsCache[idx], ...updated };
            }
            const byMonth = indexUpdatesByMonthKey(debtUpdatesCache, debtId);
            byMonth.forEach((u, mk) => {
                if (!debtFormUpdateByMonth.has(mk)) debtFormUpdateByMonth.set(mk, u.id);
            });

            for (const { date, amount, monthKey: mk } of sortedEntries) {
                const existingId = debtFormUpdateByMonth.get(mk);
                const payload = {
                    userId: currentUser.uid,
                    debtId,
                    date: date.toISOString(),
                    amount,
                    description: null
                };
                if (existingId) {
                    await saveDebtUpdate(payload, existingId);
                } else {
                    await saveDebtUpdate(payload);
                }
            }
            resetDebtForm();
            closeModal('debt-update-modal');
            showToast(entries.length === 1 ? 'Dívida salva.' : `Dívida salva (${entries.length} meses).`);
            await onDataRefresh?.();
        } catch (err) {
            console.error(err);
            showToast('Erro ao salvar.');
        } finally {
            setFormSubmittingState(form, false);
        }
    });
}

export function initDebtsForm(currentUser, onDataRefresh, onLocalRefresh) {
    if (initDebtsForm._bound) return;
    initDebtsForm._bound = true;
    bindDebtsEvents(currentUser, onDataRefresh, onLocalRefresh);
}

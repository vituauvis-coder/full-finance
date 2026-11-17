/**
 * Timeline civil reutilizável: ‹ ano › + chips Jan…Dez.
 * Mesma marcação e CSS em Painel, Saídas, Entradas, Planejamento e Carteira.
 */
import { CIVIL_MONTH_CHIP_NAMES, getDefaultCivilYear } from '../core/period-filters.js';

/** @param {string} period */
export function parseCivilPeriodMonthIndex(period) {
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return new Date().getMonth();
    return Math.min(11, Math.max(0, parseInt(m[1], 10)));
}

/** @param {number} monthIndex 0–11 */
export function civilPeriodFromMonthIndex(monthIndex) {
    const mi = Math.min(11, Math.max(0, Number(monthIndex)));
    return `month-${mi}`;
}

/**
 * @param {HTMLElement | null | undefined} chipsEl
 * @param {number} activeMonthIndex 0–11
 */
export function renderCivilPeriodTimelineChips(chipsEl, activeMonthIndex) {
    if (!chipsEl) return;
    const active = Math.min(11, Math.max(0, Number(activeMonthIndex)));
    chipsEl.innerHTML = CIVIL_MONTH_CHIP_NAMES.map((name, index) => {
        const isActive = index === active;
        return `<button type="button" class="civil-period-timeline__month-btn${isActive ? ' is-active' : ''}" data-civil-period-month="${index}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">${name}</button>`;
    }).join('');
}

/**
 * @param {HTMLElement | null | undefined} rootEl
 * @param {number} year
 */
export function setCivilPeriodYearLabel(rootEl, year) {
    const label = rootEl?.querySelector('[data-civil-period-year-label]');
    if (label) label.textContent = String(year);
}

/**
 * @param {HTMLElement | null | undefined} rootEl
 * @param {string | null | undefined} yearInputId
 * @param {number} year
 */
export function syncCivilPeriodYearToDom(rootEl, yearInputId, year) {
    const y = Number.isFinite(Number(year)) ? Number(year) : getDefaultCivilYear();
    if (yearInputId) {
        const el = document.getElementById(yearInputId);
        if (el) el.value = String(y);
    }
    setCivilPeriodYearLabel(rootEl, y);
    return y;
}

/**
 * @param {HTMLElement | null | undefined} rootEl
 * @param {{ period: string, year: number }} state
 */
export function refreshCivilPeriodTimeline(rootEl, { period, year }) {
    if (!rootEl) return;
    const chips = rootEl.querySelector('[data-civil-period-chips]');
    renderCivilPeriodTimelineChips(chips, parseCivilPeriodMonthIndex(period));
    setCivilPeriodYearLabel(rootEl, year);
}

/**
 * @param {HTMLElement} rootEl elemento `[data-civil-period-timeline]`
 * @param {HTMLElement} scopeEl página ou container (delegação de clique)
 * @param {{
 *   onYearDelta: (delta: number) => void,
 *   onMonthSelect: (monthIndex: number, period: string) => void
 * }} handlers
 */
export function bindCivilPeriodTimeline(rootEl, scopeEl, handlers) {
    if (!rootEl || rootEl.dataset.civilPeriodBound === '1') return;
    rootEl.dataset.civilPeriodBound = '1';
    scopeEl.addEventListener('click', (e) => {
        const yearDeltaBtn = e.target.closest('[data-civil-period-year-delta]');
        if (yearDeltaBtn && rootEl.contains(yearDeltaBtn)) {
            const delta = parseInt(yearDeltaBtn.getAttribute('data-civil-period-year-delta'), 10);
            if (Number.isFinite(delta)) handlers.onYearDelta(delta);
            return;
        }
        const btn = e.target.closest('[data-civil-period-month]');
        if (!btn || !rootEl.contains(btn)) return;
        const mi = parseInt(btn.getAttribute('data-civil-period-month'), 10);
        if (!Number.isFinite(mi) || mi < 0 || mi > 11) return;
        handlers.onMonthSelect(mi, civilPeriodFromMonthIndex(mi));
    });
}

/** @param {string} pageId */
export function queryCivilPeriodTimelineRoot(pageId) {
    const page = document.getElementById(pageId);
    return page?.querySelector('[data-civil-period-timeline]') ?? null;
}

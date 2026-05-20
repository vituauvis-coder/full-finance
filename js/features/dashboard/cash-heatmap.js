import {
    buildDayDetailItems,
    buildMonthDayMap,
    clampSelectedDay,
    getDefaultSelectedDay,
    resolveHeatmapMonthFromPeriod
} from './cash-heatmap-aggregations.js';
import { renderCashHeatmapCalendar } from './cash-heatmap-calendar.js';
import { renderCashHeatmapDayPanel } from './cash-heatmap-day-panel.js';

let state = {
    expenses: [],
    gains: [],
    accounts: [],
    currency: 'BRL',
    selectedDay: 1,
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth()
};

let periodListenerBound = false;

function periodValue() {
    return document.getElementById('period-filter')?.value || '';
}

function refresh() {
    const calRoot = document.getElementById('cash-heatmap-calendar-root');
    const panelRoot = document.getElementById('cash-heatmap-day-panel-root');
    if (!calRoot || !panelRoot) return;

    const { year, monthIndex } = resolveHeatmapMonthFromPeriod(periodValue());
    state.year = year;
    state.monthIndex = monthIndex;
    state.selectedDay = clampSelectedDay(state.selectedDay, year, monthIndex);

    const dayMap = buildMonthDayMap(state.expenses, state.gains, state.accounts, year, monthIndex);

    renderCashHeatmapCalendar(
        calRoot,
        { year, monthIndex, dayMap, selectedDay: state.selectedDay, userCurrency: state.currency },
        (day) => {
            state.selectedDay = day;
            refresh();
        }
    );

    const items = buildDayDetailItems(
        state.expenses,
        state.gains,
        state.accounts,
        year,
        monthIndex,
        state.selectedDay
    );

    renderCashHeatmapDayPanel(panelRoot, {
        year,
        monthIndex,
        selectedDay: state.selectedDay,
        items,
        userCurrency: state.currency
    });
}

export function refreshCashHeatmap(expenses, gains, accounts, currency) {
    state.expenses = expenses || [];
    state.gains = gains || [];
    state.accounts = accounts || [];
    state.currency = currency || 'BRL';

    const { year, monthIndex } = resolveHeatmapMonthFromPeriod(periodValue());
    const prevDay = state.selectedDay;
    state.year = year;
    state.monthIndex = monthIndex;
    state.selectedDay = clampSelectedDay(
        prevDay || getDefaultSelectedDay(year, monthIndex),
        year,
        monthIndex
    );

    if (!periodListenerBound) {
        const sel = document.getElementById('period-filter');
        sel?.addEventListener('change', () => {
            const { year: y, monthIndex: m } = resolveHeatmapMonthFromPeriod(periodValue());
            state.selectedDay = clampSelectedDay(getDefaultSelectedDay(y, m), y, m);
            refresh();
        });
        periodListenerBound = true;
    }

    refresh();
}

import { movementDateToJsDate } from './movement-date.js';

/** Entradas do mês — inclui pré-âncora, mesma regra do extrato e do gráfico de fluxo. */
export function sumProjectedGainsForCalendarMonth(mo, userGains) {
    let sum = 0;
    for (const t of userGains || []) {
        const d = movementDateToJsDate(t.date);
        if (d >= mo.start && d <= mo.end) sum += Number(t.amount) || 0;
    }
    return sum;
}
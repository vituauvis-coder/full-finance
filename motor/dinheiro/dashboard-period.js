import { movementDateToJsDate } from './movement-date.js';

function movementDate(movement) {
    return movementDateToJsDate(movement?.date);
}

/** Soma no intervalo — inclui pré-âncora (`referenceOnly`), alinhado a Entradas/Saídas e ao gráfico de fluxo. */
export function sumInPeriod(items, start, end, predicate) {
    let total = 0;
    for (const m of items) {
        const d = movementDate(m);
        if (Number.isNaN(d.getTime()) || d < start || d > end) continue;
        if (!predicate(m)) continue;
        total += Number(m.amount) || 0;
    }
    return total;
}
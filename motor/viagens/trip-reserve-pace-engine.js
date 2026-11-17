import { formatBRL } from './trips-engine.js';
import { monthAndYear, parseDayKey, startOfDayInLifeOS } from './calendar-format.js';

function parseMonth(key) {
    const parts = String(key).split('-');
    if (parts.length < 2) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!year || month < 1 || month > 12) return null;
    return { year, month };
}

export function monthKeyFromDate(date) {
    const d = startOfDayInLifeOS(date);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
}

export function monthKeyFromDayKey(dayKey) {
    if (!dayKey) return null;
    const trimmed = String(dayKey).trim();
    if (trimmed.length < 7) return null;
    const key = trimmed.slice(0, 7);
    return parseMonth(key) ? key : null;
}

export function monthsInclusive(from, to) {
    const start = parseMonth(from);
    const end = parseMonth(to);
    if (!start || !end) return null;
    return (end.year - start.year) * 12 + (end.month - start.month) + 1;
}

export function monthKeysInclusive(from, to) {
    const start = parseMonth(from);
    const end = parseMonth(to);
    if (!start || !end) return [];
    const keys = [];
    let year = start.year;
    let month = start.month;
    while (year < end.year || (year === end.year && month <= end.month)) {
        keys.push(`${year}-${String(month).padStart(2, '0')}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        if (keys.length > 36) break;
    }
    return keys;
}

function depositMonthKey(deposit) {
    return monthKeyFromDayKey(deposit.monthKey ?? deposit.month_key) ?? monthKeyFromDayKey(deposit.recordedOn ?? deposit.recorded_on);
}

function historicalAverage(deposits, saved, currentMonthKey) {
    const keys = deposits.map(depositMonthKey).filter(Boolean);
    if (!keys.length || saved <= 0) return { average: null, sampled: 0 };
    const earliest = keys.sort()[0];
    const spanStart = earliest < currentMonthKey ? earliest : currentMonthKey;
    const spanEnd = earliest > currentMonthKey ? earliest : currentMonthKey;
    const sampled = Math.max(1, monthsInclusive(spanStart, spanEnd) ?? 1);
    return { average: saved / sampled, sampled };
}

function captions({ goal, remaining, tripMonthKey, monthsLeft, monthlyNeed, historicalAverage: hist, projectedShortfall }) {
    if (goal <= 0) {
        return {
            paceCaption: 'Defina a meta de valor',
            monthsCaption: 'O ritmo mensal aparece quando há teto',
            insight: 'Preencha os tetos das categorias para acompanhar o cofrinho.'
        };
    }
    if (remaining <= 0) {
        return {
            paceCaption: 'Meta do cofrinho batida',
            monthsCaption: tripMonthKey ? `Viagem em ${monthAndYear(tripMonthKey)}` : 'O que entrar agora é folga',
            insight: 'O que entrar agora é folga para a viagem.'
        };
    }
    const gap = formatBRL(remaining);
    if (!tripMonthKey || monthsLeft <= 0 || monthlyNeed == null) {
        if (!tripMonthKey) {
            return {
                paceCaption: `Faltam ${gap}`,
                monthsCaption: 'Marque o mês da viagem',
                insight: 'Marque o mês da viagem para calcular quanto juntar por mês.'
            };
        }
        return {
            paceCaption: `Faltam ${gap}`,
            monthsCaption: 'A viagem já chegou',
            insight: `A viagem já chegou e ainda faltam ${gap} no cofrinho.`
        };
    }
    const until = monthAndYear(tripMonthKey);
    const monthsWord = monthsLeft === 1 ? '1 mês' : `${monthsLeft} meses`;
    const pace = `Junte ${formatBRL(monthlyNeed)} por mês`;
    const months = `Até ${until} · ${monthsWord}, incluindo o da viagem`;
    if (hist.average == null || projectedShortfall == null) {
        return {
            paceCaption: pace,
            monthsCaption: months,
            insight: 'Sem histórico de aportes ainda — este é o ritmo médio para fechar a meta.'
        };
    }
    const avg = `${formatBRL(hist.average)}/mês`;
    if (projectedShortfall > 1) {
        return {
            paceCaption: pace,
            monthsCaption: months,
            insight: `No ritmo atual (${avg}) ainda faltariam ${formatBRL(projectedShortfall)} no mês da viagem.`
        };
    }
    if (projectedShortfall < -1) {
        return {
            paceCaption: pace,
            monthsCaption: months,
            insight: `No ritmo atual (${avg}) você chega com cerca de ${formatBRL(-projectedShortfall)} de folga.`
        };
    }
    return { paceCaption: pace, monthsCaption: months, insight: `No ritmo atual (${avg}) a meta fecha no prazo.` };
}

export function forecast({ goal, deposits = [], startsOn, now = new Date() }) {
    const saved = deposits.reduce((p, d) => p + Math.max(Number(d.amount ?? 0), 0), 0);
    const remaining = Math.max(0, goal - saved);
    const fraction = goal > 0 ? saved / goal : 0;
    const currentMonthKey = monthKeyFromDate(now);
    const tripMonthKey = monthKeyFromDayKey(startsOn);
    const monthsLeft = tripMonthKey ? Math.max(0, monthsInclusive(currentMonthKey, tripMonthKey) ?? 0) : 0;
    let monthlyNeed = null;
    if (goal > 0 && remaining > 0 && monthsLeft > 0) {
        monthlyNeed = remaining / monthsLeft;
    } else if (remaining === 0 && goal > 0 && monthsLeft > 0) {
        monthlyNeed = 0;
    }
    const history = historicalAverage(deposits, saved, currentMonthKey);
    let projectedShortfall = null;
    if (monthlyNeed != null && history.average != null && monthsLeft > 0 && remaining > 0 && history.sampled >= 2) {
        projectedShortfall = remaining - history.average * monthsLeft;
    }
    const copy = captions({
        goal,
        remaining,
        tripMonthKey,
        monthsLeft,
        monthlyNeed,
        historicalAverage: history,
        projectedShortfall
    });
    const remainingMonthKeys =
        tripMonthKey && monthsLeft > 0 ? monthKeysInclusive(currentMonthKey, tripMonthKey) : [];
    return {
        goal,
        saved,
        remaining,
        fraction,
        tripMonthKey,
        currentMonthKey,
        monthsLeft,
        monthlyNeed,
        historicalMonthlyAverage: history.average,
        sampledMonths: history.sampled,
        projectedShortfall,
        ...copy,
        isAhead: (projectedShortfall ?? 0) < -1,
        isBehind: (projectedShortfall ?? 0) > 1,
        remainingMonthKeys
    };
}
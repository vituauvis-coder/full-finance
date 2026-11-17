/**
 * Utilitários de cálculo para Planejamento Base Zero
 * Calcula saldos disponíveis e limites de alocação
 */

import { movementDateToJsDate } from './utils.js';
import { expenseIsMarkedFixed } from './dashboard-expense-facets.js';
import { enumerateCalendarMonths } from './projected-period-net.js';
import {
    planningSaldoLivreMes,
    expenseEssentialListContributionInMonth,
    sumMovementsInRange
} from '../features/reports/reports.js';

/**
 * Chave mês civil YYYY-MM (igual Saídas / Entradas).
 * @param {number} year
 * @param {number} month 1–12
 */
function calendarMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

/** Rótulo curto de data para tabelas de explicação. */
function explainDateLabel(dateField) {
    const d = movementDateToJsDate(dateField);
    if (!Number.isNaN(d.getTime()) && d.getTime() !== 0) {
        try {
            return d.toLocaleDateString('pt-BR');
        } catch {
            /* ignore */
        }
    }
    const raw = String(dateField ?? '').trim();
    return raw.slice(0, 16) || '—';
}

/**
 * Detalha como o saldo livre do Planejamento Base Zero é obtido — **mesma base das listas Entradas / Saídas**
 * (mês civil, inclui «Expectativa de estorno» sintética nas entradas; nas saídas, parcelas do mês pendentes).
 *
 * @param {Array} gains
 * @param {Array} expenses
 * @param {number} month 1–12
 * @param {number} year
 * @param {{ accounts?: Array, userProfile?: object | null, splitOutgoing?: Array | null }} [ctx]
 * @returns {{
 *   monthKey: string,
 *   baseSaídas: string,
 *   gainRows: Array<{ id: string, data: string, descricao: string, categoria: string, valor: number, situacao: string }>,
 *   totalGains: number,
 *   essentialRows: Array<{ id: string, data: string, descricao: string, categoria: string, contribMes: number }>,
 *   totalEssentials: number,
 *   saldoLivre: number
 * }}
 */
export function explainPlanningBalance(gains, expenses, month, year, ctx = {}) {
    const monthKey = calendarMonthKey(year, month);
    const accounts = Array.isArray(ctx.accounts) ? ctx.accounts : [];
    const userProfile = ctx.userProfile ?? null;
    const splitOutgoing = ctx.splitOutgoing ?? null;
    const now = new Date();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const months = enumerateCalendarMonths(startDate, endDate);
    const mo = months[0];
    if (!mo) {
        return {
            monthKey,
            baseSaídas: 'lista',
            gainRows: [],
            totalGains: 0,
            essentialRows: [],
            totalEssentials: 0,
            saldoLivre: 0
        };
    }

    const gainsFiltered = (gains || []).filter((g) => g && !g.referenceOnly);

    /** @type {Array<{ id: string, data: string, descricao: string, categoria: string, valor: number, situacao: string }>} */
    const gainRows = [];
    for (const g of gainsFiltered) {
        const d = movementDateToJsDate(g.date);
        if (Number.isNaN(d.getTime())) continue;
        if (d < mo.start || d > mo.end) continue;
        const valor = Number(g.amount) || 0;
        gainRows.push({
            id: String(g.id ?? ''),
            data: explainDateLabel(g.date),
            descricao: String(g.description ?? '').trim().slice(0, 100) || '—',
            categoria: String(g.category ?? '').trim() || '—',
            valor,
            situacao: g.isPaid !== false ? 'Recebido' : 'Pendente'
        });
    }
    gainRows.sort((a, b) => a.data.localeCompare(b.data, 'pt') || a.id.localeCompare(b.id));

    /** @type {Array<{ id: string, data: string, descricao: string, categoria: string, contribMes: number }>} */
    const essentialRows = [];
    let totalEssentials = 0;
    for (const e of expenses || []) {
        if (!e || !expenseIsMarkedFixed(e)) continue;
        const contribMes = expenseEssentialListContributionInMonth(
            e,
            mo,
            accounts,
            userProfile,
            splitOutgoing,
            expenses
        );
        totalEssentials += contribMes;
        essentialRows.push({
            id: String(e.id ?? ''),
            data: explainDateLabel(e.date),
            descricao: String(e.description ?? '').trim().slice(0, 100) || '—',
            categoria: String(e.category ?? '').trim() || '—',
            contribMes
        });
    }
    essentialRows.sort((a, b) => b.contribMes - a.contribMes || a.id.localeCompare(b.id));

    const totalGains = sumMovementsInRange(gainsFiltered, mo.start, mo.end);
    const saldoLivre = planningSaldoLivreMes(month, year, gains, expenses, accounts, userProfile, splitOutgoing, now);

    return {
        monthKey,
        baseSaídas: 'lista',
        gainRows,
        totalGains,
        essentialRows,
        totalEssentials,
        saldoLivre
    };
}

/**
 * Saldo disponível para alocar em blocos: **igual ao painel** (soma de entradas no mês civil com
 * `sumMovementsInRange`, incluindo linhas sintéticas de expectativa de estorno) menos **só saídas essenciais**
 * no mês com a mesma soma da **lista de Saídas** (vencimento no mês, parcelas pendentes incluídas).
 *
 * @param {Array} gains - Lista de entradas (Gain)
 * @param {Array} expenses - Lista de saídas (Expense)
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @param {{ accounts?: Array, userProfile?: object | null, splitOutgoing?: Array | null }} [ctx]
 * @returns {number} Saldo disponível para alocar
 */
export function calcAvailableBalance(gains, expenses, month, year, ctx = {}) {
    const accounts = Array.isArray(ctx.accounts) ? ctx.accounts : [];
    return planningSaldoLivreMes(
        month,
        year,
        gains,
        expenses,
        accounts,
        ctx.userProfile ?? null,
        ctx.splitOutgoing ?? null,
        new Date()
    );
}

/**
 * Calcula o total já alocado em todos os blocos
 * @param {Array} blocks - Lista de blocos de orçamento
 * @returns {number} Total alocado
 */
export function calcTotalAllocated(blocks) {
    if (!blocks || blocks.length === 0) {
        return 0;
    }
    return blocks.reduce((sum, b) => sum + (b.allocatedAmount || 0), 0);
}

/**
 * Calcula o saldo restante disponível para alocar
 * Considerando o que já foi alocado em outros blocos
 * @param {number} availableBalance - Saldo total disponível
 * @param {Array} blocks - Lista de blocos (exceto o atual se editando)
 * @param {string|null} currentBlockId - ID do bloco sendo editado (exclui do cálculo)
 * @returns {number} Saldo restante para alocar
 */
export function calcRemainingBalance(availableBalance, blocks, currentBlockId = null) {
    const totalAllocated = blocks
        .filter(b => b.id !== currentBlockId)
        .reduce((sum, b) => sum + (b.allocatedAmount || 0), 0);

    return availableBalance - totalAllocated;
}

/**
 * Calcula o valor máximo que pode ser alocado em um bloco específico
 * @param {number} availableBalance - Saldo total disponível
 * @param {Array} allBlocks - Todos os blocos do mês
 * @param {string} currentBlockId - ID do bloco sendo editado
 * @param {number} currentAllocated - Valor já alocado no bloco atual
 * @returns {number} Valor máximo para o slider
 */
export function calcMaxAllocation(availableBalance, allBlocks, currentBlockId, currentAllocated) {
    const otherBlocksTotal = allBlocks
        .filter(b => b.id !== currentBlockId)
        .reduce((sum, b) => sum + (b.allocatedAmount || 0), 0);

    const remaining = availableBalance - otherBlocksTotal;

    // Retorna o máximo entre o valor já alocado (para permitir reduzir)
    // e o saldo restante disponível
    return Math.max(currentAllocated, remaining);
}

/**
 * Formata valor para exibição monetária
 * @param {number} value - Valor numérico
 * @returns {string} Valor formatado (ex: R$ 1.234,56)
 */
export function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Mapeia classes de cor Tailwind para valores hex
 * @param {string} colorClass - Classe CSS (ex: 'bg-rose-500')
 * @returns {string} Cor hexadecimal
 */
export function getColorHex(colorClass) {
    const colorMap = {
        'bg-rose-500': '#f43f5e',
        'bg-purple-500': '#a855f7',
        'bg-blue-500': '#3b82f6',
        'bg-cyan-500': '#06b6d4',
        'bg-emerald-500': '#10b981',
        'bg-amber-500': '#f59e0b',
        'bg-orange-500': '#f97316',
        'bg-fuchsia-500': '#d946ef',
        'bg-teal-500': '#14b8a6',
        'bg-red-500': '#ef4444',
        'bg-green-500': '#22c55e',
        'bg-indigo-500': '#6366f1',
        'bg-pink-500': '#ec4899',
        'bg-yellow-500': '#eab308',
        'bg-gray-500': '#6b7280'
    };
    return colorMap[colorClass] || '#f59e0b';
}

/**
 * Lista de cores disponíveis para os blocos
 * @returns {Array} Lista de objetos com classe e hex
 */
export function getAvailableColors() {
    return [
        { class: 'bg-rose-500', hex: '#f43f5e', label: 'Rosa' },
        { class: 'bg-purple-500', hex: '#a855f7', label: 'Roxo' },
        { class: 'bg-amber-500', hex: '#f59e0b', label: 'Âmbar' },
        { class: 'bg-yellow-500', hex: '#eab308', label: 'Amarelo' },
        { class: 'bg-blue-500', hex: '#3b82f6', label: 'Azul' },
        { class: 'bg-cyan-500', hex: '#06b6d4', label: 'Ciano' },
        { class: 'bg-teal-500', hex: '#14b8a6', label: 'Turquesa' },
        { class: 'bg-emerald-500', hex: '#10b981', label: 'Esmeralda' },
        { class: 'bg-orange-500', hex: '#f97316', label: 'Laranja' },
        { class: 'bg-red-500', hex: '#ef4444', label: 'Vermelho' },
        { class: 'bg-pink-500', hex: '#ec4899', label: 'Pink' },
        { class: 'bg-indigo-500', hex: '#6366f1', label: 'Índigo' },
        { class: 'bg-gray-500', hex: '#6b7280', label: 'Cinza' }
    ];
}

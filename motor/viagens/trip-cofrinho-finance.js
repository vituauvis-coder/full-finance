/**
 * Cofrinho da viagem a partir do ledger Dinheiro (tipos B e C).
 * @param {Array<{ ledgerKind?: string, amount?: number, id?: string, description?: string, date?: string | null }>} lines
 */
export function tripCofrinhoTotalsFromFinance(lines = []) {
    let aportes = 0;
    let gastosCofrinho = 0;
    for (const line of lines) {
        const amt = Math.max(0, Number(line?.amount) || 0);
        const kind = String(line?.ledgerKind ?? '').trim();
        if (kind === 'aporte') aportes += amt;
        else if (kind === 'gasto_cofrinho') gastosCofrinho += amt;
    }
    return {
        aportes,
        gastosCofrinho,
        remaining: Math.max(0, Math.round((aportes - gastosCofrinho) * 100) / 100)
    };
}

/**
 * @param {Array<{ ledgerKind?: string, amount?: number, id?: string, description?: string, date?: string | null }>} lines
 */
export function financeAportesAsDeposits(lines = []) {
    const out = [];
    for (const line of lines) {
        if (String(line?.ledgerKind ?? '').trim() !== 'aporte') continue;
        const id = String(line?.id ?? '').trim();
        if (!id) continue;
        const recordedOn = line?.date ? String(line.date).slice(0, 10) : undefined;
        out.push({
            id: `finance::${id}`,
            amount: Math.max(0, Number(line.amount) || 0),
            recordedOn,
            monthKey: recordedOn?.slice(0, 7),
            note: line.description ?? undefined
        });
    }
    return out;
}

export function hasFinanceCofrinhoLines(lines = []) {
    return lines.some((l) => {
        const k = String(l?.ledgerKind ?? '').trim();
        return k === 'aporte' || k === 'gasto_cofrinho';
    });
}
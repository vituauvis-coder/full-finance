/** Carteira de milhas da conta + comparação R$ vs pontos. */

export const MILES_PROGRAMS = [
    { brand: 'esfera', name: 'Esfera', issuer: 'Santander' },
    { brand: 'smiles', name: 'Smiles', issuer: 'GOL' },
    { brand: 'latam', name: 'LATAM Pass', issuer: 'LATAM' },
    { brand: 'livelo', name: 'Livelo', issuer: 'Livelo' },
    { brand: 'azul', name: 'TudoAzul', issuer: 'Azul' },
    { brand: 'outro', name: 'Outro programa', issuer: '' }
];

export function defaultMilesWallet() {
    return {
        programs: [
            {
                id: 'esfera',
                brand: 'esfera',
                name: 'Esfera',
                balance: 0,
                milheiroBrl: 14,
                updatedAt: null
            }
        ]
    };
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function normalizeMilesWallet(raw) {
    const fallback = defaultMilesWallet();
    if (!raw || typeof raw !== 'object') return fallback;
    const list = Array.isArray(raw.programs) ? raw.programs : [];
    const programs = list.map((p, i) => {
        const brand = MILES_PROGRAMS.some((x) => x.brand === p.brand) ? p.brand : 'outro';
        const meta = MILES_PROGRAMS.find((x) => x.brand === brand);
        return {
            id: String(p.id ?? `${brand}-${i}`),
            brand,
            name: String(p.name || meta?.name || 'Programa').trim() || 'Programa',
            balance: Math.max(0, Math.round(num(p.balance))),
            milheiroBrl: Math.max(0, num(p.milheiroBrl ?? p.milheiro_brl) || 14),
            updatedAt: p.updatedAt ?? p.updated_at ?? null
        };
    });
    if (!programs.some((p) => p.brand === 'esfera')) {
        programs.unshift(fallback.programs[0]);
    }
    return { programs };
}

/**
 * Compara pagar o trecho em dinheiro ou emitir com pontos.
 * `milheiroBrl` = reais por 1.000 pontos.
 */
export function compareCashVsPoints({ cashBrl, pointsRequired, milheiroBrl, balance }) {
    const cash = Math.max(0, num(cashBrl));
    const points = Math.max(0, Math.round(num(pointsRequired)));
    const milheiro = Math.max(0, num(milheiroBrl));
    const wallet = Math.max(0, Math.round(num(balance)));
    const pointsCostBrl = milheiro <= 0 || points <= 0 ? null : (points / 1000) * milheiro;
    const enoughPoints = points > 0 && wallet >= points;
    let cheaper = 'cash';
    if (pointsCostBrl != null && pointsCostBrl < cash) cheaper = 'points';
    if (pointsCostBrl != null && pointsCostBrl === cash) cheaper = 'tie';
    const savingBrl =
        pointsCostBrl == null ? null : Math.round((cash - pointsCostBrl) * 100) / 100;
    return {
        cashBrl: cash,
        pointsRequired: points,
        pointsCostBrl,
        enoughPoints,
        missingPoints: enoughPoints ? 0 : Math.max(0, points - wallet),
        cheaper,
        savingBrl
    };
}

export const WALLET_UNITS = [
    { id: 'pontos', label: 'Pontos', singular: 'ponto' },
    { id: 'avios', label: 'Avios', singular: 'avio' },
    { id: 'milhas', label: 'Milhas', singular: 'milha' }
];

export const MILES_PROGRAM_PRESETS = [
    { brand: 'esfera', name: 'Esfera', issuer: 'Santander', unit: 'pontos' },
    { brand: 'livelo', name: 'Livelo', issuer: 'Livelo', unit: 'pontos' },
    { brand: 'azul', name: 'Azul Fidelidade', issuer: 'Azul', unit: 'milhas' },
    { brand: 'latam', name: 'LATAM Pass', issuer: 'LATAM', unit: 'milhas' },
    { brand: 'smiles', name: 'Smiles', issuer: 'GOL', unit: 'milhas' },
    { brand: 'iberia', name: 'Iberia Club', issuer: 'Iberia', unit: 'avios' },
    { brand: 'tap', name: 'TAP Miles&Go', issuer: 'TAP', unit: 'avios' },
    { brand: 'outro', name: 'Outro programa', issuer: '', unit: 'pontos' }
];

export function presetByBrand(brand) {
    return MILES_PROGRAM_PRESETS.find((p) => p.brand === brand) ?? MILES_PROGRAM_PRESETS[MILES_PROGRAM_PRESETS.length - 1];
}

export function defaultUnitForBrand(brand) {
    return presetByBrand(brand).unit;
}

export function isWalletUnit(unit) {
    return WALLET_UNITS.some((u) => u.id === unit);
}

export function unitMeta(unit) {
    return WALLET_UNITS.find((u) => u.id === unit) ?? WALLET_UNITS[0];
}

export function unitLabel(unit, count = 2) {
    const meta = unitMeta(unit);
    return count === 1 ? meta.singular : meta.label.toLowerCase();
}

/**
 * Taxa sugerida quando ainda não há transferência salva nesse par.
 * Esfera → Avios clássico: 2 pontos de origem : 1 avio no destino.
 */
export function suggestedRate(fromUnit, toUnit) {
    const a = isWalletUnit(fromUnit) ? fromUnit : 'pontos';
    const b = isWalletUnit(toUnit) ? toUnit : 'pontos';
    if (a === b) return { from: 1, to: 1 };
    if (a === 'pontos' && b === 'avios') return { from: 2, to: 1 };
    if (a === 'avios' && b === 'pontos') return { from: 1, to: 2 };
    return { from: 1, to: 1 };
}

export function rateForPair(saved, fromUnit, toUnit, walletBonusPercent = 0) {
    if (saved && Number(saved.conversionFrom) > 0 && Number(saved.conversionTo) > 0) {
        return {
            from: Math.trunc(Number(saved.conversionFrom)),
            to: Math.trunc(Number(saved.conversionTo)),
            bonusPercent: Number(saved.bonusPercent) || 0,
            source: 'saved'
        };
    }
    const sug = suggestedRate(fromUnit, toUnit);
    const bonus = Math.max(0, Number(walletBonusPercent) || 0);
    return { ...sug, bonusPercent: bonus, source: bonus > 0 ? 'wallet' : 'suggested' };
}

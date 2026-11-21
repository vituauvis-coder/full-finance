/** Keep the newest rate per (fromProgramId → toProgramId) pair. */
export function dedupeRatesByPair(rates) {
    const best = new Map();
    for (const r of rates) {
        const key = `${r.fromProgramId}→${r.toProgramId}`;
        const prev = best.get(key);
        if (!prev || String(r.updatedAt ?? '') > String(prev.updatedAt ?? '')) best.set(key, r);
    }
    return [...best.values()];
}

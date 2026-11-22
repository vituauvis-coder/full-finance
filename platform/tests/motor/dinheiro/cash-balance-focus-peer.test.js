import test from 'node:test';
import assert from 'node:assert/strict';

// Espelha a regra de corte de duplicatas do front (conta «leve» vs migrada).
function pickPeer(scored, cap = 25) {
    scored.sort((a, b) => a.moves - b.moves || a.id.localeCompare(b.id));
    const minMoves = scored[0]?.moves ?? 0;
    const moveCutoff = Math.max(cap, minMoves + 15);
    let pool = scored.filter((s) => s.moves <= moveCutoff);
    if (pool.length === 0) pool = scored;
    const light = pool.filter((s) => s.moves <= cap);
    if (light.length > 0) return light[0].id;
    return pool[0].id;
}

test('duplicata Itaú — prioriza conta com poucos lançamentos', () => {
    const scored = [
        { id: 'heavy', moves: 350, primary: true },
        { id: 'light', moves: 8, primary: false }
    ];
    assert.equal(pickPeer(scored), 'light');
});
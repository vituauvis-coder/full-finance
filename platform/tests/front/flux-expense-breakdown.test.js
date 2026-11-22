import test from 'node:test';
import assert from 'node:assert/strict';

// Espelha a regra de balanço do gráfico (entradas − fixas − faturas).
function balancoFromFluxBreakdown(entrada, breakdown) {
    return entrada - breakdown.saidaFixa - breakdown.saidaFatura;
}

test('balanco do fluxo ignora saídas extras', () => {
    const entrada = 5000;
    const breakdown = { saidaFixa: 1200, saidaFatura: 800, saidaExtra: 400 };
    assert.equal(balancoFromFluxBreakdown(entrada, breakdown), 3000);
});
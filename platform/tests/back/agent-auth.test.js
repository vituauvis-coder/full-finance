import assert from 'node:assert/strict';
import test from 'node:test';
import { hashAgentToken, generateAgentTokenPlain, AGENT_TOKEN_PREFIX } from '../../../back/middleware/agent-auth.js';
import { parseClientDate } from '../../../back/parse-movement-date.js';
import { movementTraceFromRequest } from '../../../back/movement-trace.js';

test('generateAgentTokenPlain usa prefixo e comprimento mínimo', () => {
    const t = generateAgentTokenPlain();
    assert.ok(t.startsWith(AGENT_TOKEN_PREFIX));
    assert.ok(t.length > AGENT_TOKEN_PREFIX.length + 32);
});

test('hashAgentToken é determinístico', () => {
    const plain = 'mm_agent_teste123';
    assert.equal(hashAgentToken(plain), hashAgentToken(plain));
    assert.notEqual(hashAgentToken(plain), hashAgentToken(plain + 'x'));
});

test('parseClientDate aceita YYYY-MM-DD em Recife', () => {
    const iso = parseClientDate({ date: '2025-11-20' });
    assert.ok(iso.includes('2025-11-20T12:00:00'));
    assert.ok(iso.includes('-03:00') || iso.includes('T15:00:00.000Z'));
});

test('parseClientDate aceita seconds legado', () => {
    const iso = parseClientDate({ date: { seconds: 0 } });
    assert.equal(new Date(iso).getTime(), 0);
});

test('movementTraceFromRequest marca source agent', () => {
    const t = movementTraceFromRequest(
        { session: { authVia: 'agent' } },
        { externalRef: 'abc', receiptUrl: 'https://x' }
    );
    assert.equal(t.source, 'agent');
    assert.equal(t.externalRef, 'abc');
    assert.equal(t.receiptUrl, 'https://x');
});
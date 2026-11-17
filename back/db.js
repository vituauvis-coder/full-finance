import './load-env.js';
import dns from 'node:dns';
import pg from 'pg';

const { Pool } = pg;

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error(
        'DATABASE_URL não definido: crie um arquivo .env na raiz do repositório com DATABASE_URL=...'
    );
}

/**
 * Alguns ambientes (ex.: Railway) podem falhar com `SELF_SIGNED_CERT_IN_CHAIN` dependendo da combinação
 * pg + pg-connection-string + sslmode. O próprio driver sugere usar `uselibpqcompat=true&sslmode=require`.
 * Fazemos isso automaticamente quando a URL já pede SSL e ainda não ativou compatibilidade.
 */
try {
    const u = new URL(connectionString);
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    const wantsSsl = sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-ca' || sslmode === 'verify-full';
    const hasCompat = (u.searchParams.get('uselibpqcompat') || '').toLowerCase() === 'true';
    if (wantsSsl && !hasCompat) {
        u.searchParams.set('uselibpqcompat', 'true');
        if (!sslmode) u.searchParams.set('sslmode', 'require');
        connectionString = u.toString();
    }
} catch {
    // Se a URL não for parseável via WHATWG URL, mantemos como veio.
}

export const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

export async function query(text, params) {
    return pool.query(text, params);
}

export async function withClient(fn) {
    const client = await pool.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}

export async function withTransaction(fn) {
    return withClient(async (client) => {
        await client.query('BEGIN');
        try {
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
    });
}

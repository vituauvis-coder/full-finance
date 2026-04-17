import 'dotenv/config';
import dns from 'node:dns';
import pg from 'pg';

const { Pool } = pg;

/** Railway e outros hosts muitas vezes não alcançam IPv6; Supabase `db.*` pode resolver só AAAA. Preferir IPv4 quando existir A + AAAA. */
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Ordem: `DATABASE_URL` primeiro (ex.: pooler Supabase :6543 — costuma ser alcançável no Railway).
 * `DIRECT_URL` / `DATABASE_DIRECT_URL` para quem precisa de conexão direta :5432 (IPv4 via ipv4first ou rede com IPv6).
 */
const DATABASE_URL =
    process.env.DATABASE_URL || process.env.DATABASE_DIRECT_URL || process.env.DIRECT_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL não definido (ver .env)');
}

export const pool = new Pool({
    connectionString: DATABASE_URL,
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

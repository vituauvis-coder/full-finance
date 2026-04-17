import 'dotenv/config';
import dns from 'node:dns';
import pg from 'pg';

const { Pool } = pg;

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL não definido (ver .env)');
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

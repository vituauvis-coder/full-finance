import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

/** API Node (Railway): preferir conexão direta ao Postgres (Supabase :5432) em vez do pooler transacional (:6543), que pode falhar com BEGIN/COMMIT e prepared statements. */
const DATABASE_URL =
    process.env.DATABASE_DIRECT_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
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

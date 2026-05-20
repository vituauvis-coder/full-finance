/**
 * Backup PostgreSQL via pg_dump (stream na rota GET /api/admin/backup/database).
 *
 * Requisitos:
 * - pg_dump no PATH do processo Node (local: brew install libpq)
 * - Railway: nixpacks.toml com nixPkgs = ["postgresql"]
 * - ADMIN_DB_BACKUP_ENABLED=false desativa a rota
 *
 * Restaurar: pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump
 */
import './load-env.js';
import { brandBackupFilename } from '../js/core/app-brand.js';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { URL } from 'node:url';

const execFileAsync = promisify(execFile);

const RATE_LIMIT_MS = 15 * 60 * 1000;
const lastBackupByUser = new Map();

/** @returns {boolean} */
export function isDatabaseBackupEnabled() {
    const v = String(process.env.ADMIN_DB_BACKUP_ENABLED ?? 'true').toLowerCase();
    return v !== 'false' && v !== '0' && v !== 'no';
}

/**
 * @param {string} userId
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
export function checkBackupRateLimit(userId) {
    const last = lastBackupByUser.get(userId);
    if (!last) return { allowed: true };
    const elapsed = Date.now() - last;
    if (elapsed >= RATE_LIMIT_MS) return { allowed: true };
    return { allowed: false, retryAfterMs: RATE_LIMIT_MS - elapsed };
}

/** @param {string} userId */
export function recordBackupAttempt(userId) {
    lastBackupByUser.set(userId, Date.now());
}

/** @returns {Promise<boolean>} */
export async function checkPgDumpAvailable() {
    try {
        await execFileAsync('pg_dump', ['--version'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * @returns {{ host: string, port: string, user: string, database: string, password: string }}
 */
export function parseDatabaseUrl() {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
        throw new Error('DATABASE_URL não configurado no servidor');
    }
    const u = new URL(raw);
    const database = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres';
    return {
        host: u.hostname,
        port: u.port || '5432',
        user: decodeURIComponent(u.username || 'postgres'),
        password: decodeURIComponent(u.password || ''),
        database
    };
}

/**
 * @param {{ format?: 'custom' | 'sql' }} opts
 * @returns {import('node:child_process').ChildProcessWithoutNullStreams}
 */
export function spawnPgDump(opts = {}) {
    const format = opts.format === 'sql' ? 'plain' : 'custom';
    const { host, port, user, database, password } = parseDatabaseUrl();

    const args = [
        '--host',
        host,
        '--port',
        port,
        '--username',
        user,
        '--dbname',
        database,
        '--no-owner',
        '--no-acl',
        `--format=${format}`
    ];

    return spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: password },
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

/**
 * @param {'custom' | 'sql'} format
 */
export function backupFilename(format = 'custom') {
    return brandBackupFilename(format);
}

export function backupContentType(format = 'custom') {
    return format === 'sql' ? 'application/sql' : 'application/octet-stream';
}

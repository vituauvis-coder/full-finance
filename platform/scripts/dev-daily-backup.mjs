/**
 * Backup PostgreSQL automático no dev: no máximo 1× por dia civil (TZ local),
 * ao rodar `npm run dev`. Artefatos em platform/data/backups/daily/ (gitignored).
 *
 * Desligar: DEV_DAILY_BACKUP=0
 * Forçar: npm run db:backup
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';
import '../../back/load-env.js';
import { checkPgDumpAvailable, spawnPgDump } from '../../back/db-backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const backupRoot = path.join(root, 'platform/data/backups/daily');
const markerPath = path.join(backupRoot, '.last-backup-date');
const RETAIN_DAYS = Number(process.env.DEV_DAILY_BACKUP_RETAIN_DAYS) || 14;

function isEnabled() {
    const v = String(process.env.DEV_DAILY_BACKUP ?? 'true').toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'no';
}

/** @returns {string} YYYY-MM-DD no fuso local */
function localCalendarDay() {
    const d = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${day}`;
}

function alreadyBackedUpToday() {
    if (!existsSync(markerPath)) return false;
    try {
        return readFileSync(markerPath, 'utf8').trim() === localCalendarDay();
    } catch {
        return false;
    }
}

function pruneOldBackups() {
    if (!existsSync(backupRoot)) return;
    const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
    for (const name of readdirSync(backupRoot)) {
        if (!name.endsWith('.dump')) continue;
        const full = path.join(backupRoot, name);
        try {
            if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
        } catch {
            /* ignore */
        }
    }
}

/**
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ ran: boolean, skipped?: string, file?: string, bytes?: number }>}
 */
export async function runDailyDevBackupIfDue(opts = {}) {
    const force = Boolean(opts.force);

    if (process.env.NODE_ENV === 'production' && !force) {
        return { ran: false, skipped: 'production' };
    }
    if (!isEnabled() && !force) {
        return { ran: false, skipped: 'DEV_DAILY_BACKUP desligado' };
    }
    if (!process.env.DATABASE_URL) {
        return { ran: false, skipped: 'DATABASE_URL ausente' };
    }
    if (!force && alreadyBackedUpToday()) {
        return { ran: false, skipped: 'backup diário já feito hoje' };
    }

    if (!(await checkPgDumpAvailable())) {
        console.warn(
            '[dev-backup] pg_dump não encontrado — backup ignorado. macOS: brew install libpq e/ou PG_TOOLS_BIN_DIR no .env'
        );
        return { ran: false, skipped: 'pg_dump indisponível' };
    }

    mkdirSync(backupRoot, { recursive: true });
    const day = localCalendarDay();
    const out = path.join(backupRoot, `${day}.dump`);

    const started = Date.now();
    console.log(`[dev-backup] Gerando dump (${day})…`);

    const child = spawnPgDump({ format: 'custom' });
    const w = createWriteStream(out);
    child.stdout.pipe(w);
    let err = '';
    child.stderr.on('data', (c) => {
        err += c;
    });
    const code = await new Promise((res) => child.on('close', res));
    try {
        await finished(w);
    } catch {
        /* stream */
    }

    if (code !== 0) {
        console.error('[dev-backup] pg_dump falhou:', err.slice(0, 600));
        try {
            if (existsSync(out)) unlinkSync(out);
        } catch {
            /* ignore */
        }
        return { ran: false, skipped: 'pg_dump erro' };
    }

    const bytes = statSync(out).size;
    const sec = ((Date.now() - started) / 1000).toFixed(1);
    writeFileSync(markerPath, `${day}\n`, 'utf8');
    pruneOldBackups();
    console.log(
        `[dev-backup] OK ${(bytes / 1024 / 1024).toFixed(2)} MiB em ${sec}s → platform/data/backups/daily/${day}.dump`
    );
    return { ran: true, file: out, bytes };
}
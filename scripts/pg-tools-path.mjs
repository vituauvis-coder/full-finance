/**
 * Garante pg_dump/pg_restore no PATH (macOS: Homebrew libpq, Postgres.app, etc.).
 * Usado por npm run server / dev.
 *
 * Opcional no .env: PG_TOOLS_BIN_DIR=/caminho/para/pasta/bin
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const LIBPQ_BIN_CANDIDATES = [
    '/opt/homebrew/opt/libpq/bin',
    '/usr/local/opt/libpq/bin'
];

function postgresAppBinDir() {
    if (process.platform !== 'darwin') return null;
    const versionsRoot = '/Applications/Postgres.app/Contents/Versions';
    try {
        const versions = readdirSync(versionsRoot)
            .filter((n) => n !== 'latest')
            .sort()
            .reverse();
        for (const v of versions) {
            const bin = path.join(versionsRoot, v, 'bin');
            if (existsSync(path.join(bin, 'pg_dump'))) return bin;
        }
        const latest = path.join(versionsRoot, 'latest', 'bin');
        if (existsSync(path.join(latest, 'pg_dump'))) return latest;
    } catch {
        /* Postgres.app não instalado */
    }
    return null;
}

function libraryPostgresBinDirs() {
    if (process.platform !== 'darwin') return [];
    const out = [];
    try {
        for (const name of readdirSync('/Library/PostgreSQL')) {
            const bin = path.join('/Library/PostgreSQL', name, 'bin');
            if (existsSync(path.join(bin, 'pg_dump'))) out.push(bin);
        }
    } catch {
        /* ignore */
    }
    return out;
}

function brewLibpqBin() {
    if (process.platform !== 'darwin') return null;
    try {
        const r = spawnSync('brew', ['--prefix', 'libpq'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const prefix = r.status === 0 ? r.stdout.trim() : '';
        if (!prefix) return null;
        return path.join(prefix, 'bin');
    } catch {
        return null;
    }
}

/** @returns {string | null} diretório que contém pg_dump */
export function findPgDumpBinDir() {
    const fromEnv = process.env.PG_TOOLS_BIN_DIR?.trim();
    if (fromEnv && existsSync(path.join(fromEnv, 'pg_dump'))) return fromEnv;

    const dirs = [
        brewLibpqBin(),
        postgresAppBinDir(),
        ...libraryPostgresBinDirs(),
        ...LIBPQ_BIN_CANDIDATES
    ].filter(Boolean);
    for (const dir of dirs) {
        if (existsSync(path.join(dir, 'pg_dump'))) return dir;
    }
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
        if (dir && existsSync(path.join(dir, 'pg_dump'))) return dir;
    }
    return null;
}

/** @param {NodeJS.ProcessEnv} [base] */
export function envWithPgToolsPath(base = process.env) {
    const binDir = findPgDumpBinDir();
    if (!binDir) return { ...base };

    const sep = path.delimiter;
    const current = base.PATH || '';
    if (current.split(sep).includes(binDir)) return { ...base };

    return { ...base, PATH: `${binDir}${sep}${current}` };
}

export function logPgToolsPathHint() {
    if (findPgDumpBinDir()) return;
    if (process.platform === 'darwin') {
        console.warn(
            '[pg-tools] pg_dump não encontrado. Opções no Mac:\n' +
                '  1) Postgres.app (mais simples): https://postgresapp.com — depois reinicie npm run server\n' +
                '  2) Homebrew: instale em https://brew.sh e rode brew install libpq\n' +
                '  3) Defina no .env: PG_TOOLS_BIN_DIR=/caminho/para/pasta/bin'
        );
    } else {
        console.warn(
            '[pg-tools] pg_dump não encontrado. Instale o cliente PostgreSQL no servidor (ex.: postgresql-client).'
        );
    }
}

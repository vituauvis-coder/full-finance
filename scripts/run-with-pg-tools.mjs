#!/usr/bin/env node
/**
 * Executa um script Node com PATH ajustado para ferramentas PostgreSQL (pg_dump).
 * Uso: node scripts/run-with-pg-tools.mjs server/index.js
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { envWithPgToolsPath, logPgToolsPathHint } from './pg-tools-path.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const entry = process.argv[2];
if (!entry) {
    console.error('Uso: node scripts/run-with-pg-tools.mjs <ficheiro.js>');
    process.exit(1);
}

const target = path.isAbsolute(entry) ? entry : path.join(root, entry);
const env = envWithPgToolsPath(process.env);
logPgToolsPathHint();

const child = spawn(process.execPath, [target], {
    cwd: root,
    stdio: 'inherit',
    env
});

child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
});

#!/usr/bin/env node
/** Força backup local (ignora marcador diário). */
import { envWithPgToolsPath, logPgToolsPathHint } from './pg-tools-path.mjs';
import { runDailyDevBackupIfDue } from './dev-daily-backup.mjs';

for (const [k, v] of Object.entries(envWithPgToolsPath(process.env))) {
    process.env[k] = v;
}
logPgToolsPathHint();

const result = await runDailyDevBackupIfDue({ force: true });
if (!result.ran) {
    console.error('[db:backup]', result.skipped || 'não executado');
    process.exit(1);
}
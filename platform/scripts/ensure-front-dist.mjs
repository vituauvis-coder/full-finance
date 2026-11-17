#!/usr/bin/env node
/**
 * Railway: se o build não gerou front/dist, compila antes de subir a API.
 */
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = path.join(root, 'front', 'dist', 'index.html');

if (existsSync(indexHtml)) {
    console.log('[start] front/dist ok');
    process.exit(0);
}

console.warn('[start] front/dist ausente — npm run build:front');
const env = {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096'
};
const r = spawnSync('npm', ['run', 'build:front'], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32'
});
if (r.status !== 0) {
    console.error('[start] build:front falhou');
    process.exit(r.status ?? 1);
}
if (!existsSync(indexHtml)) {
    console.error('[start] build:front terminou mas index.html não existe');
    process.exit(1);
}
console.log('[start] front/dist gerado');
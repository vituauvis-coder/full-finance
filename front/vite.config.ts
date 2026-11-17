import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');
const apiPort = Number(process.env.PORT) || 3001;

export default defineConfig({
    root,
    /** Não compartilhar com `vite` legado (5173) — evita 504 Outdated Optimize Dep. */
    cacheDir: path.join(repoRoot, 'node_modules/.vite-front'),
    plugins: [react()],
    resolve: {
        alias: {
            '@motor': path.join(repoRoot, 'motor'),
            '@legacy': path.join(repoRoot, 'legacy-web')
        }
    },
    server: {
        host: true,
        port: 5174,
        fs: { allow: [repoRoot] },
        proxy: {
            '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
            '/uploads': { target: `http://localhost:${apiPort}`, changeOrigin: true }
        }
    }
});
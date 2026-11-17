import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiPort = Number(process.env.PORT) || 3003;
const apiOrigin = `http://localhost:${apiPort}`;
const apiProxy = {
    '/api': { target: apiOrigin, changeOrigin: true },
    '/uploads': { target: apiOrigin, changeOrigin: true }
};

export default defineConfig({
    root: path.join(__dirname, 'legacy-web'),
    cacheDir: path.join(__dirname, 'node_modules/.vite-legacy'),
    publicDir: path.join(__dirname, 'platform', 'public'),
    resolve: {
        alias: {
            '@motor': path.join(__dirname, 'motor')
        }
    },
    server: {
        host: true,
        fs: { allow: [__dirname] },
        proxy: apiProxy
    },
    preview: {
        host: true,
        proxy: apiProxy
    }
});
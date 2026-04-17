import { defineConfig } from 'vite';

const apiPort = Number(process.env.PORT) || 3003;
const apiOrigin = `http://localhost:${apiPort}`;
const apiProxy = {
    '/api': { target: apiOrigin, changeOrigin: true },
    '/uploads': { target: apiOrigin, changeOrigin: true }
};

export default defineConfig({
    server: {
        host: true,
        proxy: apiProxy
    },
    preview: {
        host: true,
        proxy: apiProxy
    }
});

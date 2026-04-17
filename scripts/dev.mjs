/**
 * Escolhe uma porta TCP livre (a partir de PORT ou 3001) e inicia API + Vite
 * com a mesma variável PORT, para o proxy do Vite coincidir com o servidor.
 */
import { createServer } from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function findFreePort(start, end) {
    return new Promise((resolve, reject) => {
        function tryPort(p) {
            if (p > end) {
                reject(new Error(`Nenhuma porta livre entre ${start} e ${end}`));
                return;
            }
            const s = createServer();
            s.once('error', (err) => {
                if (err.code === 'EADDRINUSE') tryPort(p + 1);
                else reject(err);
            });
            s.listen(p, () => {
                const addr = s.address();
                const port = typeof addr === 'object' ? addr.port : addr;
                s.close(() => resolve(port));
            });
        }
        tryPort(start);
    });
}

const preferred = Number(process.env.PORT) || 3003;
const port = await findFreePort(preferred, preferred + 40);
const env = { ...process.env, PORT: String(port) };

if (port !== preferred) {
    console.log(
        `[dev] Porta ${preferred} estava ocupada — usando ${port} para a API (proxy do Vite acompanha).`
    );
} else {
    console.log(`[dev] API na porta ${port}`);
}

// No Windows, spawn direto em npm/cmd costuma dar EINVAL; usar cmd.exe.
function spawnDevApp() {
    const opts = { cwd: root, stdio: 'inherit', env, windowsHide: true };
    if (process.platform === 'win32') {
        return spawn('cmd.exe', ['/d', '/c', 'npm', 'run', 'dev:app'], opts);
    }
    return spawn('npm', ['run', 'dev:app'], opts);
}

const child = spawnDevApp();
child.on('exit', (code) => process.exit(code ?? 0));

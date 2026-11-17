/**
 * Erros globais no browser e falhas em callbacks async (ex.: após login)
 * passam a gerar toast em vez de só sumir no console.
 * Import dinâmico de app-shell evita ciclo auth → error-handling → app-shell → auth.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function truncate(text, max = 280) {
    const s = String(text);
    return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/**
 * @param {unknown} err
 * @param {string} [context] - só para console
 */
export function reportAppError(err, context = '') {
    const raw =
        err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : err != null && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : String(err);
    const safe = escapeHtml(truncate(raw));
    const prefix = context ? `[${context}] ` : '';
    console.error(prefix, err);
    import('../shell/app-shell.js')
        .then(({ showToast }) => {
            showToast('Algo deu errado', safe, 'error', 8000);
        })
        .catch((e) => console.error('Falha ao exibir toast de erro', e));
}

export function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        if (event.target != null && event.target !== window) return;
        const msg =
            event.error instanceof Error
                ? event.error.message
                : event.message || 'Erro desconhecido';
        reportAppError(msg, 'window.error');
    });

    window.addEventListener('unhandledrejection', (event) => {
        reportAppError(event.reason, 'Promise não tratada');
    });
}

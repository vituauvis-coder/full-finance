/**
 * Universal "button loading" helper.
 *
 * Padroniza o feedback visual de botões que disparam ações assíncronas
 * (rede / persistência). Quando um botão entra em modo loading ele fica
 * desabilitado, ganha `aria-busy="true"` e tem o conteúdo substituído por
 * um spinner + label, retornando ao estado original quando termina.
 *
 * Convenção (DRY):
 * - Para `<form>`: use `setFormSubmittingState(form, true, 'Salvando...')`.
 * - Para um `<button>` qualquer: use `setButtonLoading(btn, true, { busyLabel })`.
 * - Para envolver uma operação async: use `runWithButtonLoading(btn, async () => { ... })`
 *   — garante restauração com try/finally.
 *
 * Suporta também o atributo `data-loading-label="..."` no próprio HTML do botão,
 * dispensando passar o label via JS.
 *
 * Migration map (próximas fases — fora desta primeira implementação):
 *   Fase 2 (Auth & Perfil): #login-form, #register-form, #logout-btn em
 *     js/shell/app-shell.js; #profile-form, #password-form,
 *     #finance-preferences-form, #balance-adjustment-form, upload de foto e
 *     #confirm-delete-btn em js/features/profile/profile.js.
 *   Fase 3 (Domínio): #goal-form + .delete-goal-btn em
 *     js/features/goals/goals.js; #investment-form + .delete-investment-btn em
 *     js/features/investments/investments.js; #debt-update-form +
 *     .debt-delete-update em js/features/debts/debts.js.
 *   Fase 4 (Kanban / Categorias / Base Zero): #kanban-form e ações de card em
 *     js/features/tools/tools.js; #category-save-btn, #subcategory-save-btn,
 *     #expense-subcategory-new-save e exclusões em
 *     js/features/finance/expense-categories.js e gain-categories.js;
 *     #zero-budget-block-form, [data-zb-delete], [data-zb-set-color],
 *     [data-zb-slider], [data-zb-amount-input], todos do [data-zb-todos-form]
 *     em js/features/zero-budget/zero-budget.js.
 *   Fase 5 (Toggles e relatórios): unificar spinners inline de
 *     expense-paid-toggle / gain-received-toggle / expense-fixed-toggle;
 *     aplicar feedback nos filtros de js/features/reports/reports.js; sininho
 *     de notificações em js/shared/header-notifications.js.
 *
 * Admin (admin/*) fica fora do escopo.
 */

function resolveButton(target) {
    if (!target) return null;
    if (target instanceof HTMLButtonElement) return target;
    if (target instanceof HTMLInputElement && (target.type === 'submit' || target.type === 'button')) {
        return target;
    }
    if (typeof target === 'string') {
        const el = document.querySelector(target);
        return el instanceof HTMLButtonElement ? el : null;
    }
    return null;
}

/**
 * Ativa/desativa o estado "loading" em um botão.
 * @param {HTMLButtonElement|string} button Elemento ou seletor CSS.
 * @param {boolean} isLoading
 * @param {{ busyLabel?: string, busyIconClass?: string }} [options]
 */
export function setButtonLoading(button, isLoading, options = {}) {
    const btn = resolveButton(button);
    if (!btn) return;

    const busyIconClass = options.busyIconClass || 'fa-spinner fa-spin';
    const busyLabel =
        options.busyLabel ??
        btn.dataset.loadingLabel ??
        '';

    if (isLoading) {
        if (btn.dataset.loadingActive === '1') return;
        if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        btn.dataset.loadingActive = '1';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.classList.add('btn-busy');
        const labelHtml = busyLabel
            ? `<span class="btn-busy-label">${escapeBusyLabel(busyLabel)}</span>`
            : '';
        btn.innerHTML = `<i class="fas ${busyIconClass}" aria-hidden="true"></i>${labelHtml}`;
        return;
    }

    if (btn.dataset.loadingActive !== '1' && !btn.dataset.originalHtml) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.classList.remove('btn-busy');
        return;
    }
    btn.dataset.loadingActive = '0';
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.classList.remove('btn-busy');
    if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
    }
}

/**
 * Executa uma função async garantindo o ciclo de loading no botão (try/finally).
 * Retorna o valor (ou re-lança o erro) da função recebida.
 * @template T
 * @param {HTMLButtonElement|string} button
 * @param {() => Promise<T>} asyncFn
 * @param {{ busyLabel?: string, busyIconClass?: string }} [options]
 * @returns {Promise<T>}
 */
export async function runWithButtonLoading(button, asyncFn, options = {}) {
    const btn = resolveButton(button);
    if (!btn) return asyncFn();
    setButtonLoading(btn, true, options);
    try {
        return await asyncFn();
    } finally {
        if (btn.isConnected) setButtonLoading(btn, false);
    }
}

/**
 * Estado "submitting" para `<form>`. Procura o `button[type=submit]` interno
 * e delega ao `setButtonLoading`. Mantém o nome legado usado pelos forms de
 * finanças (saídas, entradas, lote etc.).
 * @param {HTMLFormElement} form
 * @param {boolean} isSubmitting
 * @param {string} [busyLabel]
 */
export function setFormSubmittingState(form, isSubmitting, busyLabel = 'Salvando...') {
    if (!(form instanceof HTMLFormElement)) return;
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;
    form.dataset.submitting = isSubmitting ? '1' : '0';
    setButtonLoading(submitBtn, isSubmitting, { busyLabel });
}

function escapeBusyLabel(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}

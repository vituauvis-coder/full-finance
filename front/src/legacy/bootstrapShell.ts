import { applyBrandToDocument } from '../app/appBrand';
import { initPortalTooltips } from '../app/portalTooltip';
import { legacyAppState, publishAppState } from './appState';

let bootstrapped = false;

/** Apenas shell: tema, sininho, tooltips — sem `initFinance` nem `loadReportsData`. */
export function bootstrapReactShell(user: { uid: string; email: string; name?: string; role?: string }) {
    legacyAppState.currentUser = user;
    publishAppState();
    if (bootstrapped) return;
    bootstrapped = true;
    applyBrandToDocument();
    initPortalTooltips();
    const nameEl = document.getElementById('user-name-display');
    if (nameEl && !nameEl.closest('#app-sidebar.sidebar--modern')) {
        nameEl.textContent = user.name || user.email;
    }
}
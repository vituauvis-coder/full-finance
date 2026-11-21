import { AppBrandKey, writeBrandStorage } from '../../app/appBrand';

const SYNC_EVENT = 'meu-mundo:sidebar-collapse-sync';

export function isDesktopSidebarViewport(): boolean {
    return window.matchMedia('(min-width: 769px)').matches;
}

/** Aplica recolhimento no DOM, persistência e sincroniza o botão React. */
export function applySidebarCollapsed(collapsed: boolean): void {
    const main = document.getElementById('main-content');
    if (!main) return;
    main.classList.toggle('sidebar-collapsed', collapsed);

    const btn = document.getElementById('sidebar-collapse-toggle');
    if (btn) {
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
        btn.classList.toggle('is-collapsed', collapsed);
    }

    writeBrandStorage(AppBrandKey.sidebarCollapsed, collapsed ? '1' : '0');
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { collapsed } }));
}

export const sidebarCollapseSyncEvent = SYNC_EVENT;

/** Ao entrar num módulo pelo menu: fecha só o drawer no mobile (sidebar mantém aberta no desktop). */
export function collapseSidebarOnModuleNav(): void {
    if (isDesktopSidebarViewport()) return;
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    overlay?.classList.add('hidden');
    overlay?.classList.remove('open');
}
/**
 * Painel lateral de filtros — abre à direita, com overlay.
 * Reutilizável: passe o id do container e do botão que abre.
 */

export function closeFilterDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    const openBtnId = drawer.dataset.openBtn;
    const openBtn = openBtnId ? document.getElementById(openBtnId) : null;
    drawer.classList.remove('filter-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('filter-drawer-open');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
}

export function setupFilterDrawer({ drawerId, openBtnId }) {
    const drawer = document.getElementById(drawerId);
    const openBtn = document.getElementById(openBtnId);
    if (!drawer || !openBtn) return;

    drawer.dataset.openBtn = openBtnId;
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.setAttribute('aria-controls', drawerId);

    const backdrop = drawer.querySelector('.filter-drawer__backdrop');
    const closeEls = drawer.querySelectorAll('[data-filter-drawer-close]');

    function open() {
        drawer.classList.add('filter-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('filter-drawer-open');
        openBtn.setAttribute('aria-expanded', 'true');
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (drawer.classList.contains('filter-drawer--open')) {
            closeFilterDrawer(drawerId);
        } else {
            open();
        }
    });

    backdrop?.addEventListener('click', () => closeFilterDrawer(drawerId));
    closeEls.forEach((el) => el.addEventListener('click', () => closeFilterDrawer(drawerId)));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!drawer.classList.contains('filter-drawer--open')) return;
        closeFilterDrawer(drawerId);
    });
}

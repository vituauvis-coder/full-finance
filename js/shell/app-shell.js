// js/shell/app-shell.js
// CORREÇÃO: Arquivo refatorado para corrigir navegação, modais e menu mobile.
import { handleLogin, handleRegister, getAuthErrorMessage, signOut } from './auth.js';
import {
    runWithButtonLoading,
    setFormSubmittingState
} from '../core/button-loading.js';
import { AppBrand, AppBrandKey, readBrandStorage, writeBrandStorage } from '../core/app-brand.js';

// --- Estado e Callbacks do Módulo ---
let currentUser = null;
let pageLoaderCallback = null;
let authFormsListenersBound = false;

/** Admin é definido pelo campo `role` / `isAdmin` retornados pela API (banco de dados). */
function isUserAdmin(user) {
    return !!(user && (user.role === 'ADMIN' || user.isAdmin === true));
}

// --- Elementos do DOM ---
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const authContainer = document.getElementById('auth-container');
/** O container principal usa id="app" (classe app-container), não id="app-container". */
const appContainer = document.getElementById('app');

const SIDEBAR_COLLAPSE_KEY = AppBrandKey.sidebarCollapsed;

function isDesktopSidebarViewport() {
    return window.matchMedia('(min-width: 769px)').matches;
}

/** Posição da aba é só CSS (absolute na .sidebar-shell); limpa estilos inline legados. */
function clearSidebarCollapseTabInlineStyles() {
    const tab = document.getElementById('sidebar-collapse-toggle');
    if (!tab) return;
    tab.style.removeProperty('position');
    tab.style.removeProperty('top');
    tab.style.removeProperty('left');
    tab.style.removeProperty('transform');
    tab.style.removeProperty('z-index');
}

function applySidebarCollapsed(collapsed) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.classList.toggle('sidebar-collapsed', collapsed);
    const btn = document.getElementById('sidebar-collapse-toggle');
    if (btn) {
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
    }
    writeBrandStorage(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
    clearSidebarCollapseTabInlineStyles();
}

/** Aviso “em desenvolvimento” (Dívidas) — blur em tela cheia; dispensa até ao fim da sessão. */
const FEATURE_PREVIEW_STORAGE = {
    debts: 'ff_feature_preview_debts'
};

const FEATURE_PREVIEW_PAGE_IDS = ['debts'];

function updateFeaturePreviewGlobal(pageId) {
    const el = document.getElementById('feature-preview-global');
    if (!el) return;

    const hide = () => {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        el.dataset.previewKey = '';
        document.body.classList.remove('modal-open');
    };

    if (!FEATURE_PREVIEW_PAGE_IDS.includes(pageId)) {
        hide();
        return;
    }

    const sk = FEATURE_PREVIEW_STORAGE[pageId];
    let dismissed = false;
    if (sk) {
        try {
            dismissed = sessionStorage.getItem(sk) === '1';
        } catch {
            dismissed = false;
        }
    }
    if (dismissed) {
        hide();
        return;
    }

    el.dataset.previewKey = pageId;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function initFeaturePreviewOverlays() {
    const el = document.getElementById('feature-preview-global');
    const btn = el?.querySelector('.feature-preview-dismiss');
    if (btn && !btn.dataset.previewBound) {
        btn.dataset.previewBound = '1';
        btn.addEventListener('click', () => {
            const key = el?.dataset?.previewKey;
            if (key && FEATURE_PREVIEW_STORAGE[key]) {
                try {
                    sessionStorage.setItem(FEATURE_PREVIEW_STORAGE[key], '1');
                } catch {
                    /* ignore */
                }
            }
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
            el.dataset.previewKey = '';
            document.body.classList.remove('modal-open');
        });
    }

    const active = document.querySelector('#main-content .page.active');
    const pid = active?.id ? active.id.replace(/-page$/, '') : '';
    if (pid) updateFeaturePreviewGlobal(pid);
}

function initSidebarCollapse() {
    const mainContent = document.getElementById('main-content');
    const btn = document.getElementById('sidebar-collapse-toggle');
    if (!mainContent || !btn) return;

    let initialCollapsed = false;
    try {
        initialCollapsed = readBrandStorage(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
        /* ignore */
    }
    applySidebarCollapsed(initialCollapsed);

    btn.addEventListener('click', () => {
        if (!isDesktopSidebarViewport()) return;
        applySidebarCollapsed(!mainContent.classList.contains('sidebar-collapsed'));
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!isDesktopSidebarViewport()) {
                clearSidebarCollapseTabInlineStyles();
                return;
            }
            try {
                applySidebarCollapsed(readBrandStorage(SIDEBAR_COLLAPSE_KEY) === '1');
            } catch {
                /* ignore */
            }
            clearSidebarCollapseTabInlineStyles();
        }, 120);
    });

    clearSidebarCollapseTabInlineStyles();
}

/** Mantido para compatibilidade; a aba é posicionada só via CSS. */
export function refreshSidebarCollapseTabPosition() {
    clearSidebarCollapseTabInlineStyles();
}

// --- Funções Exportadas ---

/**
 * Exibe uma mensagem temporária em um elemento da UI.
 * @param {string} elementId - O ID do elemento onde a mensagem será exibida.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de mensagem ('success', 'error', 'info').
 */
export function showMessage(elementId, message, type = 'info') {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`; // Reset classes and apply new one
        messageElement.classList.remove('hidden');

        // Esconde a mensagem após 5 segundos
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }
}

/**
 * Exibe uma notificação toast (popup) que desaparece automaticamente.
 * @param {string} title - Título da notificação.
 * @param {string} message - Mensagem da notificação.
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'.
 * @param {number} duration - Duração em ms (padrão: 4000).
 */
export function showToast(title, message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    // Botão de fechar
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    container.appendChild(toast);

    // Auto-remove após duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

function removeToast(toast) {
    if (!toast || toast.classList.contains('toast-exit')) return;
    toast.classList.add('toast-exit');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

/**
 * Prepara os formulários de login e registro.
 * Esta função é chamada quando nenhum usuário está logado.
 */
export function initAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authError = document.getElementById('auth-error');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const mainContentEl = document.getElementById('main-content');

    // #app contém landing (auth-container) e área logada (main-content). Não esconder #app.
    if (authContainer) authContainer.classList.remove('hidden');
    if (mainContentEl) mainContentEl.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    if (authFormsListenersBound) return;
    authFormsListenersBound = true;

    // Listener para o formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authError) authError.textContent = '';

            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;

            setFormSubmittingState(loginForm, true, 'Entrando...');
            try {
                await handleLogin(email, password);
                // O onAuthStateChanged em main.js cuidará da transição de tela.
            } catch (error) {
                if (authError) authError.textContent = getAuthErrorMessage(error.code);
            } finally {
                setFormSubmittingState(loginForm, false);
            }
        });
    }

    // Listener para o formulário de registro
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authError) authError.textContent = '';

            const name = registerForm['register-name'].value;
            const email = registerForm['register-email'].value;
            const password = registerForm['register-password'].value;
            const confirmPassword = registerForm['register-confirm-password'].value;

            setFormSubmittingState(registerForm, true, 'Criando conta...');
            try {
                await handleRegister(name, email, password, confirmPassword);
                // O onAuthStateChanged em main.js cuidará da transição de tela.
            } catch (error) {
                if (authError) {
                    authError.textContent = error.message.includes('senhas')
                        ? error.message
                        : getAuthErrorMessage(error.code);
                }
            } finally {
                setFormSubmittingState(registerForm, false);
            }
        });
    }

    // Listener para o link "Registre-se"
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            if (authError) authError.textContent = '';
        });
    }

    // Listener para o link "Faça Login"
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            if (authError) authError.textContent = '';
        });
    }
}

/**
 * Inicializa a UI principal da aplicação após o login.
 * @param {object} user - O usuário autenticado (uid, email).
 * @param {function} loaderCallback - A função a ser chamada para carregar dados da página.
 */
export function initUI(user, loaderCallback) {
    currentUser = user;
    pageLoaderCallback = loaderCallback;

    // Mostra o app e esconde a tela de autenticação
    if (authContainer) authContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    setupMobileMenu();
    setupNavigation();
    initSidebarCollapse();
    setupUserInfoOpensProfile();
    setupModalClosers();
    setupTour();
    setupLogout(); // CORREÇÃO: Adiciona listener do botão de logout
    initFeaturePreviewOverlays();

    // Verifica se o usuário é admin para mostrar o link do painel
    const adminPanelLink = document.getElementById('admin-panel-link');
    if (adminPanelLink && isUserAdmin(user)) {
        adminPanelLink.classList.remove('hidden');
    }
}

/**
 * Abre um modal específico.
 * @param {string} modalId - O ID do modal a ser aberto.
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

/**
 * Fecha um modal específico.
 * @param {string} modalId - O ID do modal a ser fechado.
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

/**
 * CORREÇÃO: A função 'showPage' foi renomeada para 'navigateTo' e exportada conforme solicitado.
 * Esta função agora é o ponto central para a navegação de páginas.
 * @param {string} pageId - O ID da página a ser exibida (ex: 'dashboard').
 */
export function navigateTo(pageId) {
    if (pageId === 'reports') pageId = 'dashboard';
    if (pageId === 'accounts' || pageId === 'cards') pageId = 'wallet';
    const targetPageId = `${pageId}-page`;
    const pageEls = document.querySelectorAll('#main-content .page');
    pageEls.forEach((page) => {
        const show = page.id === targetPageId;
        page.classList.toggle('hidden', !show);
        page.classList.toggle('active', show);
    });

    document.querySelectorAll('#app-sidebar .nav-link').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('data-page') === pageId);
    });

    if (window.location.hash) {
        try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
            /* ignore */
        }
    }

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        userInfoEl.classList.toggle('sidebar-user-on-profile', pageId === 'profile');
    }

    /** Título + ícone da faixa roxa — mesmas classes Font Awesome do menu lateral */
    const pageHeaderById = {
        dashboard: { icon: 'fa-chart-pie', title: 'Dashboard' },
        expenses: { icon: 'fa-arrow-down', title: 'Saídas' },
        gains: { icon: 'fa-arrow-up', title: 'Entradas' },
        'zero-budget': { icon: 'fa-bullseye', title: 'Planejamento' },
        wallet: { icon: 'fa-wallet', title: 'Carteira' },
        cofrinhos: { icon: 'fa-piggy-bank', title: 'Cofrinhos' },
        debts: { icon: 'fa-triangle-exclamation', title: 'Dívidas' },
        tools: { icon: 'fa-tools', title: 'Ferramentas' },
        profile: { icon: 'fa-user', title: 'Meu Perfil' },
        support: { icon: 'fa-heart', title: 'Apoie o Projeto' }
    };
    const headerHeading = document.getElementById('header-page-heading');
    const headerEmoji = document.getElementById('current-page-emoji');
    const headerTitle = document.getElementById('current-page-title');
    const resolved = pageHeaderById[pageId] || { icon: 'fa-chart-pie', title: AppBrand.NAME };
    if (headerEmoji) {
        const ic = resolved.icon || 'fa-chart-pie';
        headerEmoji.innerHTML = `<i class="fas ${ic}" aria-hidden="true"></i>`;
    }
    if (headerTitle) headerTitle.textContent = resolved.title;
    if (headerHeading) {
        headerHeading.classList.remove('header-page-heading--emoji-swap');
        void headerHeading.offsetWidth;
        headerHeading.classList.add('header-page-heading--emoji-swap');
    }
    
    // Atualiza a cor de fundo do header baseado na página
    const appHeader = document.querySelector('.app-header');
    if (appHeader) {
        appHeader.classList.remove(
            'app-header--expenses',
            'app-header--gains',
            'app-header--zero-budget',
            'app-header--wallet',
            'app-header--cofrinhos',
            'app-header--debts'
        );
        if (pageId === 'expenses') {
            appHeader.classList.add('app-header--expenses');
        } else if (pageId === 'gains') {
            appHeader.classList.add('app-header--gains');
        } else if (pageId === 'zero-budget') {
            appHeader.classList.add('app-header--zero-budget');
        } else if (pageId === 'wallet') {
            appHeader.classList.add('app-header--wallet');
        } else if (pageId === 'cofrinhos') {
            appHeader.classList.add('app-header--cofrinhos');
        } else if (pageId === 'debts') {
            appHeader.classList.add('app-header--debts');
        }
    }

    document.getElementById('expenses-header-actions')?.classList.toggle('hidden', pageId !== 'expenses');
    document.getElementById('gains-header-actions')?.classList.toggle('hidden', pageId !== 'gains');
    document.getElementById('dashboard-header-actions')?.classList.toggle('hidden', pageId !== 'dashboard');
    document.getElementById('zero-budget-header-actions')?.classList.toggle('hidden', pageId !== 'zero-budget');
    document.getElementById('wallet-header-actions')?.classList.toggle('hidden', pageId !== 'wallet');
    document.getElementById('cofrinhos-header-actions')?.classList.toggle('hidden', pageId !== 'cofrinhos');
    document.getElementById('debts-header-actions')?.classList.toggle('hidden', pageId !== 'debts');

    // Salva a última página visitada
    localStorage.setItem('lastVisitedPage', pageId);

    // Fecha a sidebar automaticamente ao navegar em modo mobile
    const closeMenu = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    };
    if (sidebar && sidebar.classList.contains('open')) {
        closeMenu();
    }

    // Carrega os dados da página, se necessário
    if (pageLoaderCallback) {
        pageLoaderCallback(pageId, currentUser);
    }

    updateFeaturePreviewGlobal(pageId);
}

// --- Funções Internas ---

/**
 * CORREÇÃO: A lógica do menu mobile foi refeita para ser mais robusta.
 * Usa funções explícitas de abrir/fechar em vez de 'toggle' para evitar inconsistências de estado.
 */
function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle-btn'); // CORREÇÃO: ID correto

    const openMenu = () => {
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('open');
    };

    const closeMenu = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar && sidebar.classList.contains('open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    if (sidebarOverlay) {
        // Clicar no overlay sempre fecha o menu.
        sidebarOverlay.addEventListener('click', closeMenu);
    }
}

/**
 * Configura os links de navegação principal.
 */
function setupNavigation() {
    const shell = document.getElementById('app-sidebar');
    if (!shell) return;

    shell.addEventListener('click', (e) => {
        const link = e.target.closest('a.nav-link');
        if (!link || !shell.contains(link)) return;
        const pageId = link.getAttribute('data-page');
        if (!pageId) return;
        e.preventDefault();
        navigateTo(pageId);
    });
}

function setupUserInfoOpensProfile() {
    const userInfo = document.getElementById('user-info');
    if (!userInfo) return;
    userInfo.addEventListener('click', () => navigateTo('profile'));
}

/**
 * CORREÇÃO: A lógica para fechar modais foi melhorada.
 * Agora, usa delegação de eventos no 'document' para garantir que todos os modais,
 * mesmo os criados dinamicamente, possam ser fechados de forma confiável.
 */
function setupModalClosers() {
    document.addEventListener('click', (e) => {
        const target = e.target;
        // Fecha o modal se o clique for no overlay (modal-container) ou no botão de fechar.
        if (target.classList.contains('modal-container') || target.closest('.modal-close-btn')) {
            const modal = target.closest('.modal-container');
            if (modal && modal.id) {
                closeModal(modal.id);
            }
        }
    });
}

function setupTour() {
    // Lógica do tour (se houver) pode ser mantida ou adicionada aqui.
    // Exemplo: verificar se o usuário precisa ver o tour e iniciá-lo.
}

/**
 * CORREÇÃO: Configura o botão de logout
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Tem certeza que deseja sair?')) return;
            try {
                await runWithButtonLoading(logoutBtn, () => signOut(), {
                    busyLabel: 'Saindo...'
                });
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                alert('Erro ao sair. Tente novamente.');
            }
        });
    }
}
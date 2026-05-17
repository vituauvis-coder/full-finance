import { initAuth } from '../shell/auth.js';
import { initUI, navigateTo, initAuthForms, showToast } from '../shell/app-shell.js';
import { fetchAllData, calculateAllBalances } from '../services/firestore.js';
import { loadDashboardData } from '../features/dashboard/dashboard.js';
import { refreshReportsChartsForTheme, loadReportsData } from '../features/reports/reports.js';
import { initThemeFromStorage, initThemeToggle } from '../shell/theme.js';
import {
    initFinance,
    syncFinanceState,
    loadExpensesData,
    loadGainsData,
    loadWalletPage,
    showPendingSplitsLoginModal
} from '../features/finance/index.js';
import { initProfile, applyProfilePhotoFromUserProfile } from '../features/profile/profile.js';
import { initTools } from '../features/tools/tools.js';
import { initSupport } from '../features/support/support.js';
import { initGoals, loadGoalsData } from '../features/goals/index.js';
import { initInvestments, loadInvestmentsData } from '../features/investments/investments.js';
import { initDebts, loadDebtsData } from '../features/debts/debts.js';
import { initHeaderNotifications, refreshHeaderNotifications } from '../shared/header-notifications.js';
import { setupGlobalErrorHandlers } from './error-handling.js';
import { syncPeriodFilterSelectsToCurrentMonth } from '../core/period-filters.js';
import { initZeroBudgetPage, loadZeroBudgetPage, updateZeroBudgetData } from '../features/zero-budget/zero-budget.js';
import { initPortalTooltips } from '../core/portal-tooltip.js';
import { mountMovementSummaryCards } from '../components/movement-summary-cards.js';

// --- Estado Global da Aplicação ---
export let AppState = {
    currentUser: null,
    userProfile: null,
    accounts: [],
    expenses: [],
    gains: [],
    goals: [],
    investments: [],
    debts: [],
    debtUpdates: [],
    expenseSplitRequests: { incoming: [], outgoing: [] },
    userNotifications: [],
    currency: 'BRL'
};

// Expor AppState globalmente para acesso de features
window.AppState = AppState;

function onThemeChange() {
    refreshReportsChartsForTheme();
}

// --- Ponto de Entrada Principal ---
document.addEventListener('DOMContentLoaded', () => {
    setupGlobalErrorHandlers();
    initThemeFromStorage();
    initThemeToggle();
    mountMovementSummaryCards();
    initPortalTooltips();
    window.addEventListener('fullfinan-themechange', onThemeChange);
    initAuth(onAuthenticated, onSignedOut);
});

/**
 * Callback executado quando o usuário é autenticado com sucesso.
 */
async function onAuthenticated(user) {
    // CORREÇÃO: Esconde o loader e mostra o container principal do app
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    AppState.currentUser = user;
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('auth-container').classList.add('hidden');

    initUI(user, loadPageData);
    initHeaderNotifications(() => AppState, refreshAllData);

    // Antes de carregar o dashboard: o <select> do período ainda está no 1º option (Janeiro).
    // `initFinance` só sincroniza depois de `refreshAllData`, então o gráfico de saídas lia o mês errado até trocar o tipo de gráfico.
    syncPeriodFilterSelectsToCurrentMonth();

    await refreshAllData();

    // Inicializa todos os módulos, passando as funções de que precisam
    initFinance(
        user,
        AppState.accounts,
        AppState.expenses,
        AppState.gains,
        refreshAllData,
        AppState.userProfile,
        AppState.expenseSplitRequests
    );
    initProfile(user, refreshAllData);
    initTools();
    initSupport();
    initInvestments(AppState.currentUser, refreshAllData);
    initGoals(AppState.currentUser, AppState.accounts, refreshAllData);
    initDebts(AppState.currentUser, refreshAllData);
    initZeroBudgetPage();

    let lastPage = localStorage.getItem('lastVisitedPage') || 'dashboard';
    if (lastPage === 'reports') {
        lastPage = 'dashboard';
        localStorage.setItem('lastVisitedPage', 'dashboard');
    }
    if (lastPage === 'accounts' || lastPage === 'cards') {
        lastPage = 'wallet';
        localStorage.setItem('lastVisitedPage', 'wallet');
    }
    if (
        lastPage === 'feedback' ||
        lastPage === 'support' ||
        lastPage === 'transactions' ||
        lastPage === 'budgets' ||
        lastPage === 'payables'
    ) {
        lastPage =
            lastPage === 'transactions' ? 'expenses' : lastPage === 'budgets' ? 'goals' : 'dashboard';
        localStorage.setItem('lastVisitedPage', lastPage);
    }
    navigateTo(lastPage);

    showPendingSplitsLoginModal();
}

/**
 * Callback para quando o usuário faz logout.
 */
function onSignedOut() {
    // CORREÇÃO: Esconde o loader e mostra o container principal do app
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    AppState = {
        currentUser: null,
        userProfile: null,
        accounts: [],
        expenses: [],
        gains: [],
        goals: [],
        investments: [],
        debts: [],
        debtUpdates: [],
        expenseSplitRequests: { incoming: [], outgoing: [] },
        userNotifications: [],
        currency: 'BRL'
    };
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    initAuthForms(); // Inicializa os formulários de autenticação
}

/**
 * Busca todos os dados do Firestore e atualiza o estado global.
 */
async function refreshAllData() {
    const data = await fetchAllData(AppState.currentUser.uid);
    AppState.expenses = data.userExpenses || [];
    AppState.gains = data.userGains || [];
    AppState.accounts = data.userAccounts || [];
    AppState.goals = data.userGoals || [];
    AppState.investments = data.userInvestments || [];
    AppState.debts = data.userDebts || [];
    AppState.debtUpdates = data.userDebtUpdates || [];
    AppState.expenseSplitRequests = data.expenseSplitRequests || { incoming: [], outgoing: [] };
    AppState.userNotifications = data.userNotifications || [];
    AppState.userProfile = data.userProfile || null;
    if (data.userProfile?.currency) {
        AppState.currency = data.userProfile.currency;
    }
    applyProfilePhotoFromUserProfile(AppState.userProfile);

    // Recalcula saldos das contas após buscar os dados
    AppState.accounts = calculateAllBalances(
        AppState.accounts,
        AppState.expenses,
        AppState.gains,
        AppState.userProfile,
        AppState.expenseSplitRequests?.outgoing || []
    );
    syncFinanceState(
        AppState.accounts,
        AppState.expenses,
        AppState.gains,
        AppState.userProfile,
        AppState.expenseSplitRequests
    );

    // Atualizar dados do Planejamento Base Zero quando mudarem
    updateZeroBudgetData(AppState.gains, AppState.expenses);

    for (const n of AppState.userNotifications) {
        if (!n || String(n.kind) !== 'split_payer_confirmed' || n.readAt) continue;
        const k = `ff-toast-notif-${n.id}`;
        if (sessionStorage.getItem(k)) continue;
        showToast(n.title || 'Divisão', n.detail || '', 'info', 6500);
        sessionStorage.setItem(k, '1');
        break;
    }

    // Recarrega os dados da página ativa
    const activePageId = document.querySelector('.page:not(.hidden)')?.id;
    if (activePageId) {
        loadPageData(activePageId.replace('-page', ''));
    }

    refreshHeaderNotifications();
}

/**
 * Carrega os dados específicos da página solicitada.
 */
function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            loadDashboardData(
                AppState.accounts,
                AppState.expenses,
                AppState.gains,
                AppState.currency,
                AppState.userProfile,
                refreshAllData
            );
            void loadReportsData(
                AppState.expenses,
                AppState.gains,
                AppState.accounts,
                AppState.currency,
                AppState.investments,
                AppState.userProfile,
                AppState.expenseSplitRequests
            );
            break;
        case 'debts':
            loadDebtsData(AppState.debts, AppState.debtUpdates, AppState.currency);
            break;
        case 'expenses':
            loadExpensesData(AppState.expenses, AppState.accounts, AppState.currency, AppState.userProfile);
            break;
        case 'gains':
            loadGainsData(AppState.gains, AppState.accounts, AppState.currency);
            break;
        case 'zero-budget':
            loadZeroBudgetPage();
            break;
        case 'wallet':
            loadWalletPage(
                AppState.accounts,
                AppState.expenses,
                AppState.gains,
                AppState.currency,
                AppState.userProfile,
                AppState.expenseSplitRequests
            );
            break;
        case 'goals':
            loadGoalsData(AppState.goals, AppState.accounts, AppState.currency);
            break;
        case 'investments':
            loadInvestmentsData(AppState.investments, AppState.accounts, AppState.currency);
            break;
        // Os casos de profile e tools são inicializados e não precisam de recarga de dados aqui.
    }
}

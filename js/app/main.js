import { initAuth } from '../shell/auth.js';
import { initUI, navigateTo, initAuthForms, showToast } from '../shell/app-shell.js';
import { fetchAllData, calculateAllBalances } from '../services/firestore.js';
import { loadDashboardData } from '../features/dashboard/dashboard.js';
import { refreshReportsChartsForTheme, loadReportsData } from '../features/reports/reports.js';
import { AppBrandKey, applyBrandToDocument } from '../core/app-brand.js';
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
import { initCofrinhos, loadCofrinhosPage } from '../features/cofrinhos/cofrinhos-page.js';
import { setCofrinhoBucketSubcategoryFilter } from '../features/finance/expense-categories.js';
import { initDebtsPage, loadDebtsData } from '../features/debts/debts-page.js';
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
    cofrinhoBuckets: [],
    cofrinhoApplications: [],
    cofrinhoBucketGoals: [],
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
    applyBrandToDocument();
    setupGlobalErrorHandlers();
    initThemeFromStorage();
    initThemeToggle();
    mountMovementSummaryCards();
    initPortalTooltips();
    window.addEventListener(AppBrandKey.themeChangeEvent, onThemeChange);
    initAuth(onAuthenticated, onSignedOut);
});

/**
 * Callback executado quando o usuário é autenticado com sucesso.
 */
async function onAuthenticated(user) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    AppState.currentUser = user;
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('auth-container').classList.add('hidden');

    initUI(user, loadPageData);
    initHeaderNotifications(() => AppState, refreshAllData);

    syncPeriodFilterSelectsToCurrentMonth();

    await refreshAllData();

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
    initCofrinhos(AppState.currentUser, refreshAllData);
    initDebtsPage(AppState.currentUser, refreshAllData);
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
        lastPage === 'payables' ||
        lastPage === 'goals' ||
        lastPage === 'investments'
    ) {
        lastPage =
            lastPage === 'transactions'
                ? 'expenses'
                : lastPage === 'budgets' || lastPage === 'goals' || lastPage === 'investments'
                  ? 'cofrinhos'
                  : 'dashboard';
        localStorage.setItem('lastVisitedPage', lastPage);
    }
    navigateTo(lastPage);

    showPendingSplitsLoginModal();
}

/**
 * Callback para quando o usuário faz logout.
 */
function onSignedOut() {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    AppState = {
        currentUser: null,
        userProfile: null,
        accounts: [],
        expenses: [],
        gains: [],
        cofrinhoBuckets: [],
        cofrinhoApplications: [],
        cofrinhoBucketGoals: [],
        debts: [],
        debtUpdates: [],
        expenseSplitRequests: { incoming: [], outgoing: [] },
        userNotifications: [],
        currency: 'BRL'
    };
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    initAuthForms();
}

/**
 * Busca todos os dados do Firestore e atualiza o estado global.
 */
async function refreshAllData() {
    const data = await fetchAllData(AppState.currentUser.uid);
    AppState.expenses = data.userExpenses || [];
    AppState.gains = data.userGains || [];
    AppState.accounts = data.userAccounts || [];
    AppState.cofrinhoBuckets = data.cofrinhoBuckets || [];
    setCofrinhoBucketSubcategoryFilter(
        AppState.cofrinhoBuckets.map((b) => b.name).filter(Boolean)
    );
    AppState.cofrinhoApplications = data.cofrinhoApplications || [];
    AppState.cofrinhoBucketGoals = data.cofrinhoBucketGoals || [];
    AppState.debts = data.userDebts || [];
    AppState.debtUpdates = data.userDebtUpdates || [];
    AppState.expenseSplitRequests = data.expenseSplitRequests || { incoming: [], outgoing: [] };
    AppState.userNotifications = data.userNotifications || [];
    AppState.userProfile = data.userProfile || null;
    if (data.userProfile?.currency) {
        AppState.currency = data.userProfile.currency;
    }
    applyProfilePhotoFromUserProfile(AppState.userProfile);

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

    updateZeroBudgetData(AppState.gains, AppState.expenses);

    for (const n of AppState.userNotifications) {
        if (!n || String(n.kind) !== 'split_payer_confirmed' || n.readAt) continue;
        const k = `ff-toast-notif-${n.id}`;
        if (sessionStorage.getItem(k)) continue;
        showToast(n.title || 'Divisão', n.detail || '', 'info', 6500);
        sessionStorage.setItem(k, '1');
        break;
    }

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
                AppState.cofrinhoApplications,
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
        case 'cofrinhos':
            setCofrinhoBucketSubcategoryFilter(
                (AppState.cofrinhoBuckets || []).map((b) => b.name).filter(Boolean)
            );
            loadCofrinhosPage(
                AppState.expenses,
                AppState.cofrinhoBuckets,
                AppState.cofrinhoApplications,
                AppState.cofrinhoBucketGoals,
                AppState.accounts,
                AppState.currency
            );
            break;
    }
}

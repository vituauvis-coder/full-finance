// ==========================================================================
// CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================================================
import { TablePaginationController } from '../js/shared/table-pagination.js';
import { runWithButtonLoading } from '../js/core/button-loading.js';

/** Papel ADMIN vem do banco (`user.role` / `user.isAdmin` na resposta da API). */
function isUserAdmin(user) {
    return !!(user && (user.role === 'ADMIN' || user.isAdmin === true));
}

async function apiJson(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('application/json')) return res.json();
    return res.text();
}
let currentUser = null;
let usersCache = [];
let transactionsCache = [];
let statsCache = null;
let chartsInstances = {};

function chartPrimaryColor() {
    return (
        getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#404040'
    );
}

/** Cores de eixos/legendas alinhadas ao tema (claro/escuro). */
function adminChartTheme() {
    const root = getComputedStyle(document.documentElement);
    const text = root.getPropertyValue('--text-color').trim() || '#262626';
    const muted = root.getPropertyValue('--text-light').trim() || '#737373';
    const grid = root.getPropertyValue('--border-color').trim() || '#e5e5e5';
    return {
        text,
        muted,
        grid,
        primary: chartPrimaryColor()
    };
}

function adminChartScaleOptions() {
    const t = adminChartTheme();
    return {
        x: {
            grid: { color: t.grid, display: false },
            ticks: { color: t.muted, font: { size: 11 } }
        },
        y: {
            beginAtZero: true,
            grid: { color: t.grid },
            ticks: { color: t.muted, font: { size: 11 } }
        }
    };
}

function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} toast-icon"></i>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button type="button" class="toast-close" aria-label="Fechar"><i class="fas fa-times"></i></button>
    `;
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    container.appendChild(toast);
    setTimeout(() => removeToast(toast), 6000);
}

function removeToast(el) {
    if (!el?.parentNode) return;
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 300);
}

// Elementos do DOM (Cache de seletores)
const elements = {
    loginSection: document.getElementById('login-section'),
    adminPanel: document.getElementById('admin-panel'),
    accessDenied: document.getElementById('access-denied'),
    logoutBtn: document.getElementById('admin-logout-btn'),
    loginForm: document.getElementById('admin-login-form'),
    sidebarNav: document.querySelector('.sidebar-menu'),
    tabContents: document.querySelectorAll('.admin-tab-content'),
    statTotalUsers: document.getElementById('stat-total-users'),
    statNewUsers: document.getElementById('stat-new-users'),
    statTotalTransactions: document.getElementById('stat-total-transactions'),
    userSearchInput: document.getElementById('user-search-input'),
    chartPeriodSelect: document.getElementById('chart-period-select')
};

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    syncThemeToggleIcon();
    initAuthListener();
    initEventListeners();
});

function initEventListeners() {
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);

    elements.sidebarNav?.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-nav-link');
        if (btn?.dataset.tab) switchTab(btn.dataset.tab);
    });

    elements.userSearchInput.addEventListener('input', () => filterUsers());

    elements.chartPeriodSelect.addEventListener('change', (e) =>
        updateMainChart(parseInt(e.target.value, 10))
    );

    document.getElementById('admin-theme-toggle')?.addEventListener('click', toggleAdminTheme);
    document.getElementById('admin-menu-toggle')?.addEventListener('click', openAdminSidebar);
    document.getElementById('admin-sidebar-close')?.addEventListener('click', closeAdminSidebar);
    document.getElementById('admin-sidebar-overlay')?.addEventListener('click', closeAdminSidebar);

    document.querySelectorAll('.admin-modal-close, .btn-cancel').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-modal-overlay').forEach((m) => {
                m.classList.add('hidden');
                m.style.display = 'none';
            });
        });
    });

    document.getElementById('btn-db-backup')?.addEventListener('click', () =>
        downloadDatabaseBackup('custom')
    );
    document.getElementById('btn-db-backup-sql')?.addEventListener('click', () =>
        downloadDatabaseBackup('sql')
    );
}

function toggleAdminTheme() {
    const html = document.documentElement;
    const dark = html.getAttribute('data-theme') === 'dark';
    if (dark) {
        html.removeAttribute('data-theme');
        try {
            localStorage.removeItem('fullfinan-theme');
        } catch {
            /* ignore */
        }
    } else {
        html.setAttribute('data-theme', 'dark');
        try {
            localStorage.setItem('fullfinan-theme', 'dark');
        } catch {
            /* ignore */
        }
    }
    syncThemeToggleIcon();
    if (statsCache) initChartsFromStats(statsCache);
}

function syncThemeToggleIcon() {
    const icon = document.getElementById('admin-theme-icon');
    if (!icon) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
}

function openAdminSidebar() {
    document.getElementById('admin-sidebar')?.classList.add('is-open');
    const overlay = document.getElementById('admin-sidebar-overlay');
    overlay?.classList.remove('hidden');
    overlay?.classList.add('is-visible');
    document.getElementById('admin-menu-toggle')?.setAttribute('aria-expanded', 'true');
}

function closeAdminSidebar() {
    document.getElementById('admin-sidebar')?.classList.remove('is-open');
    const overlay = document.getElementById('admin-sidebar-overlay');
    overlay?.classList.add('hidden');
    overlay?.classList.remove('is-visible');
    document.getElementById('admin-menu-toggle')?.setAttribute('aria-expanded', 'false');
}

// ==========================================================================
// AUTENTICAÇÃO
// ==========================================================================
async function initAuthListener() {
    try {
        const { user } = await apiJson('/api/auth/me');
        if (user && isUserAdmin(user)) {
            currentUser = user;
            showPanel();
            loadDashboardData();
            logAdminAction('login', { email: user.email });
        } else if (user) {
            showAccessDenied();
            await apiJson('/api/auth/logout', { method: 'POST' });
        } else {
            showLogin();
        }
    } catch {
        showLogin();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const messageDiv = document.getElementById('admin-login-message');

    try {
        const { user } = await apiJson('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (user && isUserAdmin(user)) {
            currentUser = user;
            showPanel();
            loadDashboardData();
            logAdminAction('login', { email: user.email });
        } else if (user) {
            showAccessDenied();
            await apiJson('/api/auth/logout', { method: 'POST' });
        }
    } catch (error) {
        messageDiv.textContent = 'Erro ao iniciar sessão: ' + error.message;
    }
}

function handleLogout() {
    apiJson('/api/auth/logout', { method: 'POST' }).finally(() => window.location.reload());
}

// ==========================================================================
// NAVEGAÇÃO E UI
// ==========================================================================
function showPanel() {
    // Esconde Login e Acesso Negado
    elements.loginSection.classList.add('hidden');
    elements.loginSection.style.display = 'none';

    elements.accessDenied.classList.add('hidden');
    elements.accessDenied.style.display = 'none';

    elements.adminPanel.classList.remove('hidden');
    elements.adminPanel.style.display = 'flex';
    updateAdminChrome();
}

function showLogin() {
    // Esconde Painel e Acesso Negado
    elements.adminPanel.classList.add('hidden');
    elements.adminPanel.style.display = 'none';

    elements.accessDenied.classList.add('hidden');
    elements.accessDenied.style.display = 'none';

    // Mostra Login
    elements.loginSection.classList.remove('hidden');
    elements.loginSection.style.display = 'flex';
}

function showAccessDenied() {
    elements.loginSection.classList.add('hidden');
    elements.loginSection.style.display = 'none';

    elements.adminPanel.classList.add('hidden');
    elements.adminPanel.style.display = 'none';

    elements.accessDenied.classList.remove('hidden');
    elements.accessDenied.style.display = 'flex';
}

function updateAdminChrome() {
    const nameEl = document.getElementById('admin-profile-name');
    const imgEl = document.getElementById('admin-profile-photo');
    if (nameEl && currentUser) {
        nameEl.textContent = currentUser.name || currentUser.email || 'Administrador';
    }
    if (imgEl && currentUser) {
        const label = encodeURIComponent(currentUser.name || currentUser.email || 'Admin');
        imgEl.src = `https://ui-avatars.com/api/?name=${label}&background=404040&color=fff`;
        imgEl.alt = currentUser.email || '';
    }
}

function switchTab(tabId) {
    closeAdminSidebar();

    document.querySelectorAll('.sidebar-menu .admin-nav-link').forEach((btn) => {
        const on = btn.dataset.tab === tabId;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    elements.tabContents.forEach((content) => {
        if (content.id === `tab-${tabId}`) {
            content.classList.add('active');
            content.classList.remove('hidden');
            content.style.display = 'block';
        } else {
            content.classList.remove('active');
            content.classList.add('hidden');
            content.style.display = 'none';
        }
    });

    const titles = {
        dashboard: 'Visão geral',
        usuarios: 'Utilizadores',
        logs: 'Registo de auditoria',
        suporte: 'Feedbacks',
        backup: 'Backup e dados',
        settings: 'Configurações'
    };
    document.getElementById('page-title').textContent = titles[tabId] || 'Painel admin';

    if (tabId === 'usuarios') loadUsers();
    if (tabId === 'logs') {
        loadLogs(document.getElementById('log-filter-action')?.value || '', { resetPage: false });
    }
    if (tabId === 'suporte') loadFeedbacks({ resetPage: false });
    if (tabId === 'backup') loadBackupTab();
    if (tabId === 'settings') loadSettings();
}

// ==========================================================================
// DASHBOARD (KPIs + gráficos via /api/admin/stats)
// ==========================================================================
async function loadDashboardData() {
    try {
        const stats = await apiJson('/api/admin/stats');
        statsCache = stats;
        applyStatsToKPI(stats);
        initChartsFromStats(stats);
        if (usersCache.length === 0) {
            const usersList = await apiJson('/api/admin/users');
            usersCache = usersList.map((u) => ({ id: u.id, ...u }));
        }
    } catch (error) {
        showToast(error.message || String(error), 'error', 'Dashboard');
    }
}

function applyStatsToKPI(s) {
    if (elements.statTotalUsers) elements.statTotalUsers.textContent = String(s.usersTotal ?? '—');
    if (elements.statNewUsers) elements.statNewUsers.textContent = String(s.usersNew7d ?? '—');
    if (elements.statTotalTransactions) elements.statTotalTransactions.textContent = String(s.transactionsTotal ?? '—');

    const sm = document.getElementById('stat-total-managed');
    if (sm) {
        sm.textContent = `R$ ${Number(s.sumGains || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    const ab = document.getElementById('stat-avg-balance');
    if (ab) {
        ab.textContent = `R$ ${Number(s.avgAccountBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    const rr = document.getElementById('stat-retention-rate');
    if (rr) {
        rr.textContent = `${s.retentionRatePct ?? 0}%`;
    }
    const au = document.getElementById('stat-active-users');
    if (au) au.textContent = String(s.activeUsers30d ?? '—');
}

function initChartsFromStats(stats) {
    const days = parseInt(elements.chartPeriodSelect?.value || '7', 10) || 7;
    const series = days >= 30 ? stats.userGrowth30 : stats.userGrowth7;
    const labels = (series || []).map((b) => b.label);
    const dataPoints = (series || []).map((b) => b.count);
    const theme = adminChartTheme();
    const scales = adminChartScaleOptions();

    const cvGrowth = document.getElementById('usersGrowthChart');
    if (cvGrowth) {
        const ctxGrowth = cvGrowth.getContext('2d');
        if (chartsInstances.growth) chartsInstances.growth.destroy();
        chartsInstances.growth = new Chart(ctxGrowth, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Novos utilizadores',
                        data: dataPoints,
                        borderColor: theme.primary,
                        backgroundColor: 'rgba(64, 64, 64, 0.1)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: theme.primary
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales
            }
        });
        const ds = chartsInstances.growth.data.datasets[0];
        ds.backgroundColor =
            document.documentElement.getAttribute('data-theme') === 'dark'
                ? 'rgba(250, 250, 250, 0.08)'
                : 'rgba(64, 64, 64, 0.1)';
    }

    const cvFinance = document.getElementById('financeTypeChart');
    if (cvFinance) {
        const ctxFinance = cvFinance.getContext('2d');
        const receitas = Number(stats.financeDistribution?.gains || 0);
        const despesas = Number(stats.financeDistribution?.expenses || 0);
        if (chartsInstances.finance) chartsInstances.finance.destroy();
        chartsInstances.finance = new Chart(ctxFinance, {
            type: 'doughnut',
            data: {
                labels: ['Entradas (soma)', 'Saídas (soma)'],
                datasets: [
                    {
                        data: [receitas, despesas],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            color: theme.text
                        }
                    }
                }
            }
        });
    }

    const cvCategories = document.getElementById('topCategoriesChart');
    if (cvCategories) {
        const ctxCategories = cvCategories.getContext('2d');
        const top = stats.topExpenseCategories || [];
        const catLabels = top.map((c) => c.category);
        const catData = top.map((c) => c.count);
        const catColors = [theme.primary, '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#0ea5e9', '#64748b'];
        if (chartsInstances.categories) chartsInstances.categories.destroy();
        chartsInstances.categories = new Chart(ctxCategories, {
            type: 'bar',
            data: {
                labels: catLabels.length ? catLabels : ['—'],
                datasets: [
                    {
                        label: 'Saídas por categoria (contagem)',
                        data: catData.length ? catData : [0],
                        backgroundColor: catLabels.map((_, i) => catColors[i % catColors.length]),
                        borderRadius: 8
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ...scales.x, grid: { color: theme.grid } },
                    y: { ...scales.y, grid: { display: false } }
                }
            }
        });
    }
}

function updateMainChart(days) {
    if (!statsCache) return;
    const series = days >= 30 ? statsCache.userGrowth30 : statsCache.userGrowth7;
    const labels = (series || []).map((b) => b.label);
    const dataPoints = (series || []).map((b) => b.count);
    const pc = chartPrimaryColor();
    if (chartsInstances.growth) {
        chartsInstances.growth.data.labels = labels;
        chartsInstances.growth.data.datasets[0].data = dataPoints;
        chartsInstances.growth.data.datasets[0].borderColor = pc;
        chartsInstances.growth.update();
    }
}

// ==========================================================================
// GESTÃO DE USUÁRIOS
// ==========================================================================
async function loadUsers() {
    const container = document.getElementById('user-cards-container');
    container.innerHTML =
        '<div class="admin-empty-state"><i class="fas fa-spinner fa-spin"></i> A carregar…</div>';

    try {
        const usersList = await apiJson('/api/admin/users');
        usersCache = usersList.map((u) => ({ id: u.id, ...u }));
        if (!transactionsCache.length) {
            try {
                transactionsCache = await apiJson('/api/admin/ledger?limit=3000');
            } catch {
                transactionsCache = [];
            }
        }
        applyUserFilters();
    } catch (error) {
        container.innerHTML = `<div class="admin-empty-state" style="color:var(--danger-color)">${error.message}</div>`;
        showToast(error.message, 'error', 'Utilizadores');
    }
}

function renderUsers(users) {
    const container = document.getElementById('user-cards-container');
    container.innerHTML = '';

    if (users.length === 0) {
        container.innerHTML = '<div class="admin-empty-state">Nenhum usuário encontrado.</div>';
        return;
    }

    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        const avatarUrl =
            user.profilePhotoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=7c3aed&color=fff`;
        const transactionCount =
            typeof user.ledgerCount === 'number'
                ? user.ledgerCount
                : transactionsCache.filter((t) => t.userId === user.id).length;

        // Data de criação formatada
        let createdDate = '-';
        if (user.createdAt) {
            const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
            createdDate = date.toLocaleDateString('pt-BR');
        }

        card.innerHTML = `
            <img src="${avatarUrl}" alt="${user.name}">
            <div class="user-name">${user.name || 'Sem Nome'}</div>
            <div class="user-email">${user.email}</div>
            <div class="user-stats">
                <span title="Lançamentos"><i class="fas fa-list"></i> ${transactionCount}</span>
                <span title="Criado em"><i class="fas fa-calendar"></i> ${createdDate}</span>
            </div>
            
            <div class="user-actions">
                <button class="user-action-btn" onclick="openUserDetails('${user.id}')" title="Ver Detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="user-action-btn" onclick="resetUserPassword('${user.id}')" title="Resetar Senha">
                    <i class="fas fa-key"></i>
                </button>
                <button class="user-action-btn danger" onclick="confirmDeleteUser('${user.id}')" title="Excluir Usuário">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterUsers(query) {
    applyUserFilters();
}

function applyUserFilters() {
    const searchTerm = document.getElementById('user-search-input')?.value.toLowerCase() || '';
    const activityFilter = document.getElementById('user-filter-activity')?.value || '';
    const sortBy = document.getElementById('user-sort-by')?.value || 'name';

    // Calcular usuários ativos (com transações nos últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUserIds = new Set(
        transactionsCache
            .filter(t => {
                if (!t.date) return false;
                const date = t.date.toDate ? t.date.toDate() : new Date(t.date);
                return date > thirtyDaysAgo;
            })
            .map(t => t.userId)
    );

    // Filtrar
    let filtered = usersCache.filter(user => {
        // Busca por texto
        const matchesSearch = !searchTerm ||
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm));

        // Filtro de atividade
        let matchesActivity = true;
        if (activityFilter === 'active') {
            matchesActivity = activeUserIds.has(user.id);
        } else if (activityFilter === 'inactive') {
            matchesActivity = !activeUserIds.has(user.id);
        }

        return matchesSearch && matchesActivity;
    });

    // Ordenar
    if (sortBy === 'name') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'date') {
        filtered.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
    } else if (sortBy === 'ledger') {
        filtered.sort((a, b) => {
            const countA = transactionsCache.filter(t => t.userId === a.id).length;
            const countB = transactionsCache.filter(t => t.userId === b.id).length;
            return countB - countA;
        });
    }

    renderUsers(filtered);
}

// Event listeners para filtros avançados
document.getElementById('user-filter-activity')?.addEventListener('change', applyUserFilters);
document.getElementById('user-sort-by')?.addEventListener('change', applyUserFilters);

// ==========================================================================
// FUNÇÕES GLOBAIS (MODAIS E AÇÕES)
// ==========================================================================
window.openUserDetails = async (userId) => {
    const modal = document.getElementById('user-details-modal');
    const title = document.getElementById('user-details-title');
    const user = usersCache.find(u => u.id === userId);

    title.textContent = `Detalhes: ${user ? user.name : userId}`;
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Exibe o modal

    const lists = {
        accounts: document.querySelector('#details-accounts-section .details-list'),
        cofrinhos: document.querySelector('#details-cofrinhos-section .details-list')
    };

    Object.values(lists).forEach(l => l.innerHTML = '<li>Carregando...</li>');

    const details = await apiJson(`/api/admin/user/${userId}/details`);
    const accounts = details.accounts || [];
    const cofrinhoBuckets = details.cofrinhoBuckets || [];
    const summary = details.summary || {};
    const sumEl = document.getElementById('user-details-summary');
    if (sumEl) {
        const last = summary.lastActivity
            ? new Date(summary.lastActivity).toLocaleString('pt-BR')
            : '—';
        sumEl.innerHTML = `
            <strong>Resumo:</strong> ${summary.expenseCount ?? 0} saídas · ${summary.gainCount ?? 0} entradas · última movimentação: <strong>${last}</strong>
        `;
    }

    lists.accounts.innerHTML = '';
    if (accounts.length === 0) lists.accounts.innerHTML = '<li>Nenhuma conta.</li>';
    else
        accounts.forEach((acc) => {
            const balance = parseFloat(acc.initialBalance) || 0;
            const li = document.createElement('li');
            li.innerHTML = `
            <span>${acc.name || 'Sem nome'} (R$ ${balance.toFixed(2)})</span>
            <button class="btn-action primary" style="padding: 2px 8px; font-size: 0.7rem;" 
                onclick="openAdjustBalanceModal('${acc.id}', '${userId}')">Ajustar</button>
        `;
            lists.accounts.appendChild(li);
        });

    lists.cofrinhos.innerHTML = '';
    if (cofrinhoBuckets.length === 0) lists.cofrinhos.innerHTML = '<li>Nenhum cofrinho.</li>';
    else
        cofrinhoBuckets.forEach((b) => {
            const li = document.createElement('li');
            li.textContent = b.name || 'Cofrinho';
            lists.cofrinhos.appendChild(li);
        });
};

window.openAdjustBalanceModal = (accountId, userId) => {
    document.getElementById('adjust-account-id').value = accountId;
    document.getElementById('adjust-user-id').value = userId;
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-reason').value = '';
    const modal = document.getElementById('adjust-balance-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

document.getElementById('adjust-balance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('adjust-account-id').value;
    const userId = document.getElementById('adjust-user-id').value;
    const type = document.getElementById('adjust-type').value;
    const amount = parseFloat(document.getElementById('adjust-amount').value);
    const reason = document.getElementById('adjust-reason').value;

    if (!amount || amount <= 0) {
        showToast('Indique um valor válido.', 'warning');
        return;
    }

    try {
        await apiJson(`/api/admin/accounts/${accountId}/balance`, {
            method: 'PATCH',
            body: JSON.stringify({ type, amount })
        });

        showToast('Saldo inicial atualizado.', 'success');
        logAdminAction('adjust_balance', { accountId, userId, type, amount, reason });

        const modal = document.getElementById('adjust-balance-modal');
        modal.classList.add('hidden');
        modal.style.display = 'none';

        openUserDetails(userId);
    } catch (error) {
        showToast(error.message, 'error', 'Ajuste de saldo');
    }
});

window.resetUserPassword = async (userId) => {
    const u = usersCache.find((x) => x.id === userId);
    const label = u?.email || userId;
    if (!confirm(`Gerar uma nova senha temporária para ${label}?`)) return;
    try {
        const { temporaryPassword } = await apiJson(`/api/admin/users/${userId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showToast(temporaryPassword, 'success', 'Nova palavra-passe temporária (copie agora)');
        logAdminAction('reset_password', { userId, email: u?.email });
    } catch (err) {
        showToast(err.message, 'error', 'Repor palavra-passe');
    }
};

let userToDeleteId = null;
window.confirmDeleteUser = (userId) => {
    userToDeleteId = userId;
    document.getElementById('delete-confirmation-input').value = '';
    document.getElementById('btn-confirm-delete').disabled = true;
    const modal = document.getElementById('modal-confirm-delete');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

document.getElementById('delete-confirmation-input').addEventListener('input', (e) => {
    document.getElementById('btn-confirm-delete').disabled = e.target.value !== 'DELETAR';
});

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (!userToDeleteId) return;

    try {
        const deletedUser = usersCache.find((u) => u.id === userToDeleteId);
        await apiJson(`/api/admin/users/${userToDeleteId}`, { method: 'DELETE' });

        logAdminAction('delete_user', {
            userId: userToDeleteId,
            email: deletedUser?.email || 'unknown'
        });

        showToast('Utilizador e dados associados foram eliminados.', 'success');
        const modal = document.getElementById('modal-confirm-delete');
        modal.classList.add('hidden');
        modal.style.display = 'none';

        usersCache = usersCache.filter((u) => u.id !== userToDeleteId);
        transactionsCache = [];
        applyUserFilters();
        loadDashboardData();

    } catch (error) {
        showToast(error.message, 'error', 'Eliminar utilizador');
    }
});

// ==========================================================================
// SISTEMA DE LOG DE AUDITORIA
// ==========================================================================

/**
 * Registra uma ação administrativa
 */
async function logAdminAction(action, details = {}) {
    try {
        await apiJson('/api/admin/logs', {
            method: 'POST',
            body: JSON.stringify({
                action,
                details,
                adminEmail: currentUser?.email || 'unknown',
                adminId: currentUser?.uid || 'unknown',
                userAgent: navigator.userAgent
            })
        });
    } catch {
        /* ignore */
    }
}

let logsPagination = null;
let logsItems = [];

const LOG_ACTION_LABELS = {
    login: '🔐 Login',
    delete_user: '🗑️ Exclusão de Usuário',
    adjust_balance: '💰 Ajuste de Saldo',
    reset_password: '🔑 Reset de Senha',
    view_details: '👁️ Visualização',
    export_csv: '📥 Exportação CSV',
    role_change: '👤 Alteração de papel (USER/ADMIN)',
    backup: '📦 Backup JSON',
    database_backup: '💾 Backup PostgreSQL'
};

let backupCapabilities = null;
let lastDatabaseBackupAt = null;

async function loadBackupTab() {
    const statusEl = document.getElementById('backup-capabilities-text');
    const lastEl = document.getElementById('backup-last-info');
    const btnDump = document.getElementById('btn-db-backup');
    const btnSql = document.getElementById('btn-db-backup-sql');

    try {
        backupCapabilities = await apiJson('/api/admin/backup/capabilities');
        const { enabled, pgDumpAvailable, rateLimitMinutes } = backupCapabilities;

        if (!enabled) {
            statusEl.innerHTML =
                '<span class="admin-status-pill admin-status-pill--warn"><i class="fas fa-ban"></i> Desativado no servidor</span> O administrador desativou backups via <code>ADMIN_DB_BACKUP_ENABLED</code>.';
            btnDump.disabled = true;
            btnSql.disabled = true;
        } else if (!pgDumpAvailable) {
            statusEl.innerHTML =
                '<span class="admin-status-pill admin-status-pill--warn"><i class="fas fa-exclamation-triangle"></i> pg_dump indisponível</span> Instale o cliente PostgreSQL no servidor onde a API roda (local: <code>brew install libpq</code>; Railway: <code>nixpacks.toml</code> com postgresql).';
            btnDump.disabled = true;
            btnSql.disabled = true;
        } else {
            statusEl.innerHTML = `<span class="admin-status-pill admin-status-pill--ok"><i class="fas fa-check-circle"></i> Pronto</span> Backup completo via pg_dump (limite: 1 a cada ${rateLimitMinutes || 15} min por administrador).`;
            btnDump.disabled = false;
            btnSql.disabled = false;
        }
    } catch (e) {
        statusEl.textContent = 'Não foi possível verificar o servidor: ' + e.message;
        btnDump.disabled = true;
        btnSql.disabled = true;
    }

    if (lastEl) {
        lastEl.textContent = lastDatabaseBackupAt
            ? `Último backup nesta sessão: ${new Date(lastDatabaseBackupAt).toLocaleString('pt-BR')}`
            : '';
    }
}

function parseContentDispositionFilename(header) {
    if (!header) return null;
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1].replace(/"/g, '').trim());
    } catch {
        return m[1].replace(/"/g, '').trim();
    }
}

async function downloadDatabaseBackup(format = 'custom') {
    const btn =
        format === 'sql'
            ? document.getElementById('btn-db-backup-sql')
            : document.getElementById('btn-db-backup');

    await runWithButtonLoading(btn, async () => {
        const q = format === 'sql' ? '?format=sql' : '';
        const res = await fetch(`/api/admin/backup/database${q}`, { credentials: 'include' });

        if (!res.ok) {
            let msg = res.statusText;
            try {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const body = await res.json();
                    msg = body.error || msg;
                } else {
                    msg = (await res.text()) || msg;
                }
            } catch {
                /* ignore */
            }
            throw new Error(msg);
        }

        const blob = await res.blob();
        const generatedAt = res.headers.get('X-Backup-Generated-At');
        const filename =
            parseContentDispositionFilename(res.headers.get('Content-Disposition')) ||
            `full-finance-backup.${format === 'sql' ? 'sql' : 'dump'}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        lastDatabaseBackupAt = generatedAt || new Date().toISOString();
        loadBackupTab();
        showToast(`Download iniciado: ${filename}`, 'success', 'Backup PostgreSQL');
    }, { busyLabel: 'Gerando backup…' }).catch((e) => {
        showToast(e.message || String(e), 'error', 'Backup PostgreSQL');
    });
}

function renderAdminLogsTable() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    logsItems.forEach((log) => {
        const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
        const dateStr = timestamp.toLocaleDateString('pt-BR');
        const timeStr = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const actionLabel = LOG_ACTION_LABELS[log.action] || log.action;
        let detailsStr = log.details;
        if (detailsStr && typeof detailsStr === 'string') {
            try {
                const o = JSON.parse(detailsStr);
                detailsStr =
                    typeof o === 'object'
                        ? Object.entries(o)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')
                        : detailsStr;
            } catch {
                /* manter string */
            }
        } else if (detailsStr && typeof detailsStr === 'object') {
            detailsStr = Object.entries(detailsStr)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
        }
        detailsStr = String(detailsStr || '—');
        const adminLabel = log.adminEmail || log.adminName || '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td><strong>${dateStr}</strong><br><small>${timeStr}</small></td>
                <td><span class="badge">${actionLabel}</span></td>
                <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis;" title="${detailsStr.replace(/"/g, '&quot;')}">${detailsStr}</td>
                <td><small>${adminLabel}</small></td>
            `;
        tbody.appendChild(tr);
    });
}

async function loadLogs(filterAction = '', options = {}) {
    const resetPage = options.resetPage === true;
    const tbody = document.getElementById('logs-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center">A carregar…</td></tr>';

    const bar = document.getElementById('admin-logs-pagination');
    if (!logsPagination && bar) {
        logsPagination = new TablePaginationController(bar, {
            storageKey: 'admin-logs',
            onChange: () => {
                const fa = document.getElementById('log-filter-action')?.value || '';
                loadLogs(fa, { resetPage: false });
            }
        });
    }

    const from = document.getElementById('log-date-from')?.value || '';
    const to = document.getElementById('log-date-to')?.value || '';
    const { page, pageSize } = logsPagination ? logsPagination.getState() : { page: 1, pageSize: 25 };

    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
    });
    if (filterAction) params.set('action', filterAction);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const data = await apiJson('/api/admin/logs?' + params.toString());
        logsItems = data.items || [];
        if (logsPagination) {
            logsPagination.setTotal(data.total ?? 0, { resetPage });
        }
        if (!logsItems.length && tbody) {
            tbody.innerHTML =
                '<tr><td colspan="4" class="text-center">Nenhum registo encontrado.</td></tr>';
            return;
        }
        renderAdminLogsTable();
    } catch (error) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--danger-color)">${error.message}</td></tr>`;
        }
        if (logsPagination) logsPagination.setTotal(0);
        showToast(error.message, 'error', 'Logs');
    }
}

document.getElementById('log-filter-action')?.addEventListener('change', (e) => {
    loadLogs(e.target.value, { resetPage: true });
});

document.getElementById('log-date-from')?.addEventListener('change', () => {
    const fa = document.getElementById('log-filter-action')?.value || '';
    loadLogs(fa, { resetPage: true });
});

document.getElementById('log-date-to')?.addEventListener('change', () => {
    const fa = document.getElementById('log-filter-action')?.value || '';
    loadLogs(fa, { resetPage: true });
});

document.getElementById('btn-refresh-logs')?.addEventListener('click', () => {
    const filter = document.getElementById('log-filter-action')?.value || '';
    loadLogs(filter, { resetPage: false });
});

// ==========================================================================
// FEEDBACKS
// ==========================================================================

let feedbackPagination = null;
let feedbackItems = [];

function renderFeedbackTable() {
    const tbody = document.getElementById('feedback-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    feedbackItems.forEach((row) => {
        const d = row.createdAt ? new Date(row.createdAt) : new Date();
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.textContent = d.toLocaleString('pt-BR');
        const td2 = document.createElement('td');
        const sm = document.createElement('small');
        sm.textContent = row.user?.email || row.user?.name || '—';
        td2.appendChild(sm);
        const td3 = document.createElement('td');
        td3.style.maxWidth = '420px';
        td3.style.whiteSpace = 'pre-wrap';
        td3.textContent = row.message || '';
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
    });
}

async function loadFeedbacks(options = {}) {
    const resetPage = options.resetPage === true;
    const tbody = document.getElementById('feedback-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">A carregar…</td></tr>';

    const bar = document.getElementById('admin-feedback-pagination');
    if (!feedbackPagination && bar) {
        feedbackPagination = new TablePaginationController(bar, {
            storageKey: 'admin-feedbacks',
            onChange: () => loadFeedbacks({ resetPage: false })
        });
    }

    const { page, pageSize } = feedbackPagination
        ? feedbackPagination.getState()
        : { page: 1, pageSize: 20 };

    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

    try {
        const data = await apiJson('/api/admin/feedbacks?' + params.toString());
        feedbackItems = data.items || [];
        if (feedbackPagination) {
            feedbackPagination.setTotal(data.total ?? 0, { resetPage });
        }
        if (!feedbackItems.length && tbody) {
            tbody.innerHTML = '<tr><td colspan="3">Nenhuma mensagem ainda.</td></tr>';
            return;
        }
        renderFeedbackTable();
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="color:var(--danger-color)">${e.message}</td></tr>`;
        if (feedbackPagination) feedbackPagination.setTotal(0);
        showToast(e.message, 'error', 'Feedbacks');
    }
}

// ==========================================================================
// CONFIGURAÇÕES E EXTRAS
// ==========================================================================

async function loadSettings() {
    if (usersCache.length === 0) {
        try {
            const usersList = await apiJson('/api/admin/users');
            usersCache = usersList.map((u) => ({ id: u.id, ...u }));
        } catch {
            /* ignore */
        }
    }
    renderAdminList();

    try {
        const meta = await apiJson('/api/admin/meta');
        const vEl = document.getElementById('sys-app-version');
        const bEl = document.getElementById('sys-backend-label');
        const uEl = document.getElementById('sys-uploads-hint');
        if (vEl) vEl.textContent = meta.appVersion || '—';
        if (bEl) bEl.textContent = meta.projectLabel || '—';
        if (uEl) uEl.textContent = meta.uploadsPath || 'data/uploads';
    } catch {
        /* ignore */
    }

    const hEl = document.getElementById('sys-health-status');
    if (hEl) hEl.textContent = '…';
    try {
        const h = await apiJson('/api/admin/health');
        if (hEl) hEl.textContent = h.ok && h.database ? 'OK' : 'Erro';
    } catch {
        if (hEl) hEl.textContent = 'Indisponível';
    }
}

function renderAdminList() {
    const container = document.getElementById('admin-list-container');
    if (!container) return;

    const admins = usersCache.filter((u) => u.role === 'ADMIN');
    container.innerHTML = admins.map((u) => `
        <div class="admin-item">
            <span class="email">${u.email}</span>
            ${u.id === currentUser?.uid
            ? '<span class="badge">Você</span>'
            : `<button class="btn-remove" onclick="removeAdminRole('${u.id}')" title="Remover papel ADMIN">
                     <i class="fas fa-times"></i>
                   </button>`
        }
        </div>
    `).join('');
}

document.getElementById('btn-add-admin')?.addEventListener('click', async () => {
    const input = document.getElementById('new-admin-email');
    const email = input?.value.trim().toLowerCase();

    if (!email || !email.includes('@')) {
        showToast('Endereço de email inválido.', 'warning');
        return;
    }

    const target = usersCache.find((u) => (u.email || '').toLowerCase() === email);
    if (!target) {
        showToast('Utilizador não encontrado — precisa de conta existente.', 'warning');
        return;
    }
    if (target.role === 'ADMIN') {
        showToast('Este utilizador já é administrador.', 'info');
        return;
    }

    try {
        const updated = await apiJson(`/api/admin/users/${target.id}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'ADMIN' })
        });
        const idx = usersCache.findIndex((x) => x.id === target.id);
        if (idx >= 0) usersCache[idx] = { ...usersCache[idx], ...updated };
        input.value = '';
        renderAdminList();
        logAdminAction('role_change', { email: target.email, newRole: 'ADMIN' });
        showToast('Papel ADMIN atribuído.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

window.removeAdminRole = async (userId) => {
    if (userId === currentUser?.uid) {
        showToast('Não pode remover o seu próprio papel de administrador aqui.', 'warning');
        return;
    }

    if (!confirm('Remover o papel de administrador deste usuário?')) return;

    try {
        const updated = await apiJson(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'USER' })
        });
        const idx = usersCache.findIndex((x) => x.id === userId);
        if (idx >= 0) usersCache[idx] = { ...usersCache[idx], ...updated };
        renderAdminList();
        logAdminAction('role_change', { userId, newRole: 'USER' });
        showToast('Papel alterado para USER.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// Exportação JSON (aba Backup)
document.getElementById('btn-backup-users')?.addEventListener('click', () => {
    runWithButtonLoading(document.getElementById('btn-backup-users'), async () => {
        downloadJSON(usersCache, 'users_backup');
        await logAdminAction('backup', { type: 'users', count: usersCache.length });
        showToast('Exportação JSON iniciada.', 'success');
    });
});

document.getElementById('btn-backup-ledger')?.addEventListener('click', () => {
    runWithButtonLoading(document.getElementById('btn-backup-ledger'), async () => {
        downloadJSON(transactionsCache, 'ledger_backup');
        await logAdminAction('backup', { type: 'ledger', count: transactionsCache.length });
        showToast('Exportação JSON iniciada.', 'success');
    });
});

document.getElementById('btn-backup-all')?.addEventListener('click', () => {
    runWithButtonLoading(document.getElementById('btn-backup-all'), async () => {
        const allData = {
            users: usersCache,
            ledger: transactionsCache,
            exportDate: new Date().toISOString(),
            exportedBy: currentUser?.email
        };

        try {
            const admin_logs = [];
            let page = 1;
            let total = 1;
            while (admin_logs.length < total) {
                const batch = await apiJson(`/api/admin/logs?page=${page}&pageSize=100`);
                const items = batch.items || [];
                admin_logs.push(...items);
                total = batch.total ?? admin_logs.length;
                if (!items.length) break;
                page += 1;
                if (page > 200) break;
            }
            allData.admin_logs = admin_logs;
        } catch (e) {
            showToast('Pacote sem auditoria completa: ' + e.message, 'warning');
            allData.admin_logs = [];
        }

        downloadJSON(allData, 'full_backup');
        await logAdminAction('backup', { type: 'full' });
        showToast('Pacote JSON gerado.', 'success');
    });
});

function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
import { updateUserProfile, uploadFile, deleteUserAccount } from '../../services/firestore.js';
import { showMessage, openModal, closeModal, refreshSidebarCollapseTabPosition } from '../../shell/app-shell.js';
import { api } from '../../api-client.js';
import { DEFAULT_FINANCE_PREFERENCES, getFinancePreferences } from '../../core/finance-preferences.js';

let currentUser = null;
let onAppDataRefresh = null;

/**
 * Inicializa a página de perfil, configurando os listeners de formulários e botões.
 * @param {() => Promise<void>} [onRefreshAllData] — após salvar preferências de caixa, recarrega dados globais.
 */
export function initProfile(user, onRefreshAllData) {
    currentUser = user;
    onAppDataRefresh = onRefreshAllData || null;
    loadProfileData();

    document.getElementById('profile-form')?.addEventListener('submit', handleProfileUpdate);
    document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);
    document.getElementById('change-photo-btn')?.addEventListener('click', () => document.getElementById('profile-photo-input').click());
    document.getElementById('profile-photo-input')?.addEventListener('change', handlePhotoUpload);
    document.getElementById('remove-photo-btn')?.addEventListener('click', handlePhotoRemove);
    document.getElementById('delete-account-btn')?.addEventListener('click', openDeleteModal);
    document.getElementById('confirm-delete-btn')?.addEventListener('click', handleDeleteAccount);
    document.getElementById('confirm-email')?.addEventListener('input', validateDeleteEmail);

    document.getElementById('finance-preferences-form')?.addEventListener('submit', handleFinancePreferencesSubmit);
    document.getElementById('finance-pref-manual-enabled')?.addEventListener('change', syncFinancePrefSuboptions);

    document.getElementById('default-currency')?.addEventListener('change', syncAccountSnapshot);
    window.addEventListener('fullfinan-themechange', syncAccountSnapshot);
}

/**
 * Carrega os dados do perfil do usuário nos campos da página.
 */
async function loadProfileData() {
    try {
        const userData = await api('/api/profile');
        document.getElementById('profile-name').value = userData.name || '';
        const nameDisplay = document.getElementById('user-name-display');
        const displayName = userData.name || currentUser.email || '';
        if (nameDisplay) nameDisplay.textContent = displayName;
        const heroTitle = document.getElementById('profile-hero-title');
        if (heroTitle) heroTitle.textContent = displayName;
        const heroEmail = document.getElementById('profile-hero-email');
        if (heroEmail) heroEmail.textContent = currentUser.email || '';
        document.getElementById('profile-email').value = currentUser.email;
        document.getElementById('default-currency').value = userData.currency || 'BRL';
        updateProfileImages(userData.profilePhotoURL);
        fillFinancePreferencesForm(userData);
        syncAccountSnapshot();
        refreshSidebarCollapseTabPosition();
    } catch (error) {
        console.error('Erro ao carregar dados do perfil: ', error);
        showMessage('profile-message', 'Não foi possível carregar seus dados. Verifique se a API local está rodando.', 'error');
    }
}

/** Atualiza o painel «Detalhes da conta» (e-mail, moeda, tema). */
function syncAccountSnapshot() {
    const emailInput = document.getElementById('profile-email');
    const snapEmail = document.getElementById('profile-snapshot-email');
    if (emailInput && snapEmail) {
        snapEmail.textContent = (emailInput.value || '').trim() || '—';
    }

    const cur = document.getElementById('default-currency');
    const snapCur = document.getElementById('profile-snapshot-currency');
    if (cur && snapCur) {
        const opt = cur.options[cur.selectedIndex];
        snapCur.textContent = opt ? opt.textContent.replace(/\s+/g, ' ').trim() : '—';
    }

    const snapTheme = document.getElementById('profile-snapshot-theme');
    if (snapTheme) {
        snapTheme.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Escuro' : 'Claro';
    }
}

function fillFinancePreferencesForm(userData) {
    const prefs = getFinancePreferences(userData);
    const m = prefs.manualCashOut || DEFAULT_FINANCE_PREFERENCES.manualCashOut;
    const en = document.getElementById('finance-pref-manual-enabled');
    const cc = document.getElementById('finance-pref-cc');
    const loan = document.getElementById('finance-pref-loan');
    const monthly = document.getElementById('finance-pref-monthly');
    if (en) en.checked = !!m.enabled;
    if (cc) cc.checked = m.creditCard !== false;
    if (loan) loan.checked = m.loan !== false;
    if (monthly) monthly.checked = m.monthlyFixed !== false;
    syncFinancePrefSuboptions();
}

function syncFinancePrefSuboptions() {
    const en = document.getElementById('finance-pref-manual-enabled');
    const sub = document.getElementById('finance-pref-suboptions');
    if (sub) sub.disabled = !en?.checked;
}

async function handleFinancePreferencesSubmit(e) {
    e.preventDefault();
    const en = document.getElementById('finance-pref-manual-enabled');
    const cc = document.getElementById('finance-pref-cc');
    const loan = document.getElementById('finance-pref-loan');
    const monthly = document.getElementById('finance-pref-monthly');
    const financePreferences = {
        manualCashOut: {
            enabled: en?.checked === true,
            creditCard: cc?.checked !== false,
            loan: loan?.checked !== false,
            monthlyFixed: monthly?.checked !== false
        }
    };
    try {
        await updateUserProfile(currentUser.uid, { financePreferences });
        showMessage('finance-preferences-message', 'Preferências de caixa salvas.', 'success');
        await onAppDataRefresh?.();
    } catch (err) {
        console.error(err);
        showMessage('finance-preferences-message', 'Não foi possível salvar. Tente novamente.', 'error');
    }
}

function updateProfileImages(photoURL) {
    const defaultPhoto =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23e2e8f0'/><text x='50' y='55' text-anchor='middle' font-size='30' fill='%2394a3b8'>👤</text></svg>";
    const url = photoURL || defaultPhoto;
    document.getElementById('profile-photo-preview').src = url;
    document.getElementById('sidebar-user-photo').src = url;
    document.getElementById('remove-photo-btn').classList.toggle('hidden', !photoURL);
    refreshSidebarCollapseTabPosition();
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const newName = document.getElementById('profile-name').value.trim();
    if (!newName) return;

    try {
        await updateUserProfile(currentUser.uid, { name: newName });
        document.getElementById('user-name-display').textContent = newName;
        const heroTitle = document.getElementById('profile-hero-title');
        if (heroTitle) heroTitle.textContent = newName;
        refreshSidebarCollapseTabPosition();
        showMessage('profile-message', 'Nome atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar nome:', error);
        showMessage('profile-message', 'Não foi possível atualizar o perfil. Tente novamente.', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const form = e.target;
    const currentPassword = form['current-password'].value;
    const newPassword = form['new-password'].value;

    try {
        await api('/api/profile/password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        form.reset();
        showMessage('password-message', 'Senha alterada com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        const message = error.code === 'auth/wrong-password' ? 'Senha atual incorreta.' : 'Erro ao alterar senha. Tente novamente.';
        showMessage('password-message', message, 'error');
    }
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const photoURL = await uploadFile(file, currentUser.uid);
        await updateUserProfile(currentUser.uid, { profilePhotoURL: photoURL });
        updateProfileImages(photoURL);
        showMessage('personalization-message', 'Foto de perfil atualizada!', 'success');
    } catch (error) {
        console.error('Erro ao enviar a foto:', error);
        showMessage('personalization-message', 'Não foi possível enviar a foto. Tente novamente.', 'error');
    }
}

async function handlePhotoRemove() {
    if (!confirm('Tem certeza que deseja remover sua foto de perfil?')) return;
    try {
        await updateUserProfile(currentUser.uid, { profilePhotoURL: null });
        updateProfileImages(null);
        showMessage('personalization-message', 'Foto removida com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao remover a foto:', error);
        showMessage('personalization-message', 'Não foi possível remover a foto. Tente novamente.', 'error');
    }
}

function openDeleteModal() {
    document.getElementById('user-email-display').textContent = currentUser.email;
    document.getElementById('confirm-email').value = '';
    document.getElementById('confirm-delete-btn').disabled = true;
    openModal('delete-account-modal');
}

function validateDeleteEmail(e) {
    document.getElementById('confirm-delete-btn').disabled = e.target.value !== currentUser.email;
}

async function handleDeleteAccount() {
    const deleteButton = document.getElementById('confirm-delete-btn');
    deleteButton.disabled = true;
    deleteButton.textContent = 'Excluindo...';

    try {
        await deleteUserAccount();
        alert('Conta deletada com sucesso. Você será desconectado.');
        window.location.reload();
    } catch (error) {
        console.error('Erro ao deletar conta:', error);
        showMessage('delete-account-message', 'Erro ao deletar conta. Tente novamente.', 'error');
        deleteButton.disabled = false;
        deleteButton.textContent = 'Eu entendo as consequências, deletar minha conta';
    }
}

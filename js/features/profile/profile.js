import { updateUserProfile, deleteUserAccount, fetchDashboardPeriodBalance } from '../../services/firestore.js';
import { showMessage, openModal, closeModal, refreshSidebarCollapseTabPosition } from '../../shell/app-shell.js';
import { api } from '../../api-client.js';
import { DEFAULT_FINANCE_PREFERENCES, getFinancePreferences } from '../../core/finance-preferences.js';
import { getPeriodDateBounds } from '../../core/period-filters.js';
import {
    runWithButtonLoading,
    setButtonLoading,
    setFormSubmittingState
} from '../../core/button-loading.js';
import { playPingSound, isUiSoundEnabled, setUiSoundEnabled } from '../../core/ui-sounds.js';

let currentUser = null;
let onAppDataRefresh = null;

function syncUiSoundsCheckboxFromStorage() {
    const el = document.getElementById('ui-sounds-enabled');
    if (el) el.checked = isUiSoundEnabled();
}

function initUiSoundsCheckbox() {
    const el = document.getElementById('ui-sounds-enabled');
    if (!el || el.dataset.boundUiSounds === '1') return;
    el.dataset.boundUiSounds = '1';
    syncUiSoundsCheckboxFromStorage();
    el.addEventListener('change', () => {
        setUiSoundEnabled(el.checked);
        if (el.checked) {
            playPingSound();
        }
    });
}

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
    document.getElementById('balance-adjustment-form')?.addEventListener('submit', handleBalanceAdjustment);
    document.getElementById('delete-account-btn')?.addEventListener('click', openDeleteModal);
    document.getElementById('confirm-delete-btn')?.addEventListener('click', handleDeleteAccount);
    document.getElementById('confirm-email')?.addEventListener('input', validateDeleteEmail);

    document.getElementById('finance-preferences-form')?.addEventListener('submit', handleFinancePreferencesSubmit);
    document.getElementById('finance-pref-manual-enabled')?.addEventListener('change', syncFinancePrefSuboptions);

    initUiSoundsCheckbox();

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
        
        const balanceInput = document.getElementById('profile-current-balance');
        if (balanceInput) {
            const now = new Date();
            const { startDate, endDate } = getPeriodDateBounds(`month-${now.getMonth()}`, now);
            const balance = await fetchDashboardPeriodBalance(startDate, endDate);
            balanceInput.value = balance || 0;
        }

        updateProfileImages(userData.profilePhotoURL);
        fillFinancePreferencesForm(userData);
        syncUiSoundsCheckboxFromStorage();
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
    const form = e.target;
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
    setFormSubmittingState(form, true, 'Salvando preferências...');
    try {
        await updateUserProfile(currentUser.uid, { financePreferences });
        showMessage('finance-preferences-message', 'Preferências de caixa salvas.', 'success');
        playPingSound();
        await onAppDataRefresh?.();
    } catch (err) {
        console.error(err);
        showMessage('finance-preferences-message', 'Não foi possível salvar. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

function updateProfileImages(photoURL) {
    const defaultPhoto =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23e5e5e5'/><text x='50' y='55' text-anchor='middle' font-size='30' fill='%23a3a3a3'>👤</text></svg>";
    const url = photoURL || defaultPhoto;
    const preview = document.getElementById('profile-photo-preview');
    const side = document.getElementById('sidebar-user-photo');
    if (preview) preview.src = url;
    if (side) side.src = url;
    document.getElementById('remove-photo-btn')?.classList.toggle('hidden', !photoURL);
    refreshSidebarCollapseTabPosition();
}

/** Usa `userProfile` já carregado em `/api/data` (ex.: após F5) para não depender só da página Perfil. */
export function applyProfilePhotoFromUserProfile(userProfile) {
    const raw = userProfile?.profilePhotoURL;
    const url = raw != null && String(raw).trim() !== '' ? String(raw) : null;
    updateProfileImages(url);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const newName = document.getElementById('profile-name').value.trim();
    if (!newName) return;

    setFormSubmittingState(form, true, 'Salvando...');
    try {
        await updateUserProfile(currentUser.uid, { name: newName });
        document.getElementById('user-name-display').textContent = newName;
        const heroTitle = document.getElementById('profile-hero-title');
        if (heroTitle) heroTitle.textContent = newName;
        refreshSidebarCollapseTabPosition();
        showMessage('profile-message', 'Nome atualizado com sucesso!', 'success');
        playPingSound();
    } catch (error) {
        console.error('Erro ao atualizar nome:', error);
        showMessage('profile-message', 'Não foi possível atualizar o perfil. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const form = e.target;
    const currentPassword = form['current-password'].value;
    const newPassword = form['new-password'].value;

    setFormSubmittingState(form, true, 'Alterando senha...');
    try {
        await api('/api/profile/password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        form.reset();
        showMessage('password-message', 'Senha alterada com sucesso!', 'success');
        playPingSound();
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        const message = error.code === 'auth/wrong-password' ? 'Senha atual incorreta.' : 'Erro ao alterar senha. Tente novamente.';
        showMessage('password-message', message, 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

/** Mesma lógica do Kanban: imagem em Base64 (data URL) no banco, sem upload de arquivo. */
const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

function readProfileImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('INVALID_TYPE'));
            return;
        }
        if (file.size > PROFILE_PHOTO_MAX_BYTES) {
            reject(new Error('TOO_LARGE'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = () => reject(new Error('READ'));
        reader.readAsDataURL(file);
    });
}

async function handlePhotoUpload(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const changeBtn = document.getElementById('change-photo-btn');
    if (changeBtn) setButtonLoading(changeBtn, true, { busyLabel: 'Enviando...' });
    try {
        const dataUrl = await readProfileImageAsDataUrl(file);
        await updateUserProfile(currentUser.uid, { profilePhotoURL: dataUrl });
        updateProfileImages(dataUrl);
        showMessage('personalization-message', 'Foto de perfil atualizada!', 'success');
        playPingSound();
    } catch (error) {
        console.error('Erro ao processar a foto:', error);
        const msg =
            error?.message === 'INVALID_TYPE'
                ? 'Selecione uma imagem válida (JPG, PNG, GIF…).'
                : error?.message === 'TOO_LARGE'
                  ? 'Imagem muito grande. Tamanho máximo: 2 MB.'
                  : 'Não foi possível salvar a foto. Tente novamente.';
        showMessage('personalization-message', msg, 'error');
    } finally {
        input.value = '';
        if (changeBtn) setButtonLoading(changeBtn, false);
    }
}

async function handlePhotoRemove() {
    if (!confirm('Tem certeza que deseja remover sua foto de perfil?')) return;
    const removeBtn = document.getElementById('remove-photo-btn');
    try {
        if (removeBtn) {
            await runWithButtonLoading(removeBtn, () =>
                updateUserProfile(currentUser.uid, { profilePhotoURL: null })
            , { busyLabel: 'Removendo...' });
        } else {
            await updateUserProfile(currentUser.uid, { profilePhotoURL: null });
        }
        updateProfileImages(null);
        showMessage('personalization-message', 'Foto removida com sucesso!', 'success');
        playPingSound();
    } catch (error) {
        console.error('Erro ao remover a foto:', error);
        showMessage('personalization-message', 'Não foi possível remover a foto. Tente novamente.', 'error');
    }
}

async function handleBalanceAdjustment(e) {
    e.preventDefault();
    const form = e.target;
    const balance = parseFloat(document.getElementById('profile-current-balance').value);
    if (isNaN(balance)) return;

    setFormSubmittingState(form, true, 'Atualizando saldo...');
    try {
        await api('/api/profile/balance', {
            method: 'POST',
            body: JSON.stringify({ balance })
        });
        showMessage('balance-adjustment-message', 'Saldo atualizado com sucesso!', 'success');
        playPingSound();
        if (onAppDataRefresh) await onAppDataRefresh();
    } catch (error) {
        console.error('Erro ao ajustar saldo:', error);
        showMessage('balance-adjustment-message', 'Erro ao atualizar saldo. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
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
    if (!deleteButton) return;

    try {
        await runWithButtonLoading(deleteButton, () => deleteUserAccount(), {
            busyLabel: 'Excluindo...'
        });
        alert('Conta deletada com sucesso. Você será desconectado.');
        window.location.reload();
    } catch (error) {
        console.error('Erro ao deletar conta:', error);
        showMessage('delete-account-message', 'Erro ao deletar conta. Tente novamente.', 'error');
    }
}

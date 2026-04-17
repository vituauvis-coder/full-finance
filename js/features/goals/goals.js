import { formatCurrency, isCardAccountType } from '../../core/utils.js';
import { saveGoal, deleteGoal } from '../../services/firestore.js';
import { openModal, closeModal, showMessage } from '../../shell/app-shell.js';

let currentUser;
let userAccounts;
let onUpdateCallback;
let latestGoals = [];

export const GOAL_TYPES = {
    viagem: { emoji: '✈️', label: 'Viagem' },
    casa: { emoji: '🏠', label: 'Casa/Imóvel' },
    veiculo: { emoji: '🚗', label: 'Veículo' },
    educacao: { emoji: '📚', label: 'Educação' },
    saude: { emoji: '💚', label: 'Saúde' },
    aposentadoria: { emoji: '☀️', label: 'Aposentadoria' },
    emergencia: { emoji: '🛡️', label: 'Reserva Emergência' },
    outro: { emoji: '✨', label: 'Outro' }
};

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}

function isAccountLinkableToGoal(acc) {
    return acc && !isCardAccountType(acc.type);
}

function getLinkedAccountIds(goal) {
    if (Array.isArray(goal.linkedAccountIds)) return goal.linkedAccountIds.map(String);
    return [];
}

/**
 * Progresso: apenas o valor guardado no próprio objetivo (`currentAmount`).
 * Contas vinculadas são só referência de onde o dinheiro fica — o saldo da conta não entra aqui.
 */
function getGoalProgressAmount(goal) {
    return Math.max(0, Number(goal.currentAmount) || 0);
}

function populateGoalAccountSelect(selectedAccountId = '') {
    const select = document.getElementById('goal-account');
    if (!select) return;

    const accounts = (userAccounts || []).filter(isAccountLinkableToGoal);
    
    let html = '<option value="">Nenhuma</option>';
    accounts.forEach((acc) => {
        const selected = String(acc.id) === String(selectedAccountId) ? ' selected' : '';
        html += `<option value="${escapeHtml(acc.id)}"${selected}>${escapeHtml(acc.name)}</option>`;
    });
    select.innerHTML = html;
}

export function initGoals(user, accounts, onUpdate) {
    currentUser = user;
    userAccounts = accounts;
    onUpdateCallback = onUpdate;

    document.getElementById('add-goal-btn')?.addEventListener('click', () => openGoalModal());
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('goals-list')?.addEventListener('click', handleGoalListClick);
}

export function loadGoalsData(userGoals, userAccountsArg, currency) {
    const goalsList = document.getElementById('goals-list');
    if (!goalsList) return;

    latestGoals = userGoals || [];
    userAccounts = userAccountsArg;

    goalsList.innerHTML = '';

    if (!userGoals || userGoals.length === 0) {
        goalsList.innerHTML = `
            <div class="goals-empty-state">
                <div class="goals-empty-state__icon" aria-hidden="true"><i class="fas fa-bullseye"></i></div>
                <p class="goals-empty-state__title">Nenhum objetivo ainda</p>
                <p class="goals-empty-state__text">Crie um objetivo, defina quanto já guardou e, se quiser, indique em qual conta esse dinheiro fica — só como referência.</p>
            </div>`;
        return;
    }

    userGoals.forEach((goal) => {
        const rawType = goal.goalType || 'outro';
        const typeKey = GOAL_TYPES[rawType] ? rawType : 'outro';
        const typeInfo = GOAL_TYPES[typeKey];
        const currentAmount = getGoalProgressAmount(goal);
        const target = Number(goal.targetAmount) || 1;
        const progress = Math.min((currentAmount / target) * 100, 100);

        const ids = getLinkedAccountIds(goal);
        const linkedAccounts = ids
            .map((id) => userAccountsArg.find((a) => a.id === id))
            .filter(Boolean);

        let accountsSummary = '—';
        if (linkedAccounts.length === 1) {
            accountsSummary = linkedAccounts[0].name;
        } else if (linkedAccounts.length > 1) {
            const extra = linkedAccounts.length - 1;
            accountsSummary = `${linkedAccounts[0].name} · +${extra} ${extra === 1 ? 'conta' : 'contas'}`;
        }

        const progressHint = 'Quanto você já guardou para este objetivo';

        const card = document.createElement('article');
        card.className = `goal-card goal-card--${typeKey}`;
        card.dataset.goalId = goal.id;
        card.innerHTML = `
            <div class="goal-card__scene" aria-hidden="true">
                <div class="goal-card__scene-art">
                    <div class="goal-card__sky"></div>
                    <div class="goal-card__sun"></div>
                    <div class="goal-card__hill goal-card__hill--back"></div>
                    <div class="goal-card__hill goal-card__hill--front"></div>
                    <div class="goal-card__water">
                        <div class="goal-card__water-shade goal-card__water-shade--1"></div>
                        <div class="goal-card__water-shade goal-card__water-shade--2"></div>
                        <div class="goal-card__reflection"></div>
                        <div class="goal-card__reflection goal-card__reflection--b"></div>
                        <div class="goal-card__reflection goal-card__reflection--c"></div>
                    </div>
                    <div class="goal-card__scene-veil"></div>
                </div>
                <div class="goal-card__scene-overlay">
                    <span class="goal-card__badge"><i class="fas fa-bullseye" aria-hidden="true"></i> ${escapeHtml(typeInfo.label)}</span>
                    <div class="goal-card__actions">
                        <button type="button" class="btn-action edit-goal-btn" data-id="${escapeHtml(goal.id)}" title="Editar objetivo" aria-label="Editar objetivo"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="btn-action delete-goal-btn" data-id="${escapeHtml(goal.id)}" title="Excluir objetivo" aria-label="Excluir objetivo"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="goal-card__scene-emoji">${typeInfo.emoji}</div>
            </div>
            <div class="goal-card__body">
                <div class="goal-card__headline">
                    <div class="goal-card__headline-left">
                        <div class="goal-card__headline-icon">${typeInfo.emoji}</div>
                        <p class="goal-card__headline-type">${escapeHtml(typeInfo.label)}</p>
                    </div>
                    <div class="goal-card__headline-right">
                        <div class="goal-card__headline-name-row">
                            <span class="goal-card__headline-name">${escapeHtml(goal.name)}</span>
                        </div>
                        <p class="goal-card__headline-sub">${escapeHtml(progressHint)}</p>
                        <p class="goal-card__headline-metric"><span class="goal-card__headline-metric-value">${progress.toFixed(1)}</span><span class="goal-card__headline-metric-unit">%</span></p>
                    </div>
                </div>
                <div class="goal-card__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}" aria-label="Progresso da meta">
                    <div class="goal-card__progress-fill" style="width: ${progress}%;"></div>
                </div>
                <div class="goal-card__forecast">
                    <div class="goal-card__stat-row">
                        <span>Já guardado</span>
                        <span class="goal-card__stat-value goal-card__stat-value--accent">${formatCurrency(currentAmount, currency)}</span>
                    </div>
                    <div class="goal-card__separator"></div>
                    <div class="goal-card__stat-row">
                        <span>Meta</span>
                        <span class="goal-card__stat-value">${formatCurrency(goal.targetAmount, currency)}</span>
                    </div>
                    <div class="goal-card__separator"></div>
                    <div class="goal-card__stat-row goal-card__stat-row--accounts">
                        <span>Onde guarda</span>
                        <span class="goal-card__stat-value goal-card__stat-value--wrap">${escapeHtml(accountsSummary)}</span>
                    </div>
                </div>
            </div>`;
        goalsList.appendChild(card);
    });
}

function openGoalModal(existingGoal) {
    const form = document.getElementById('goal-form');
    if (!form) return;
    form.reset();
    form['goal-id'].value = '';

    const titleEl = document.getElementById('goal-modal-title');
    if (titleEl) titleEl.textContent = existingGoal ? 'Editar objetivo' : 'Novo objetivo';

    const subtitleEl = document.getElementById('goal-modal-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = existingGoal
            ? 'Altere o que precisar. O progresso segue o campo Já guardado.'
            : 'Nome, tipo, valores e, se quiser, uma conta só para referência.';
    }

    populateGoalAccountSelect(existingGoal?.linkedAccountIds?.[0] || '');

    if (existingGoal) {
        form['goal-id'].value = existingGoal.id;
        form['goal-name'].value = existingGoal.name || '';
        form['goal-target-amount'].value = existingGoal.targetAmount ?? '';
        form['goal-current-amount'].value =
            existingGoal.currentAmount != null && existingGoal.currentAmount !== ''
                ? existingGoal.currentAmount
                : '0';
        const rawType = existingGoal.goalType || 'outro';
        const typeKey = GOAL_TYPES[rawType] ? rawType : 'outro';
        const typeRadio = form.querySelector(`input[name="goal-type"][value="${typeKey}"]`);
        if (typeRadio) typeRadio.checked = true;
    } else {
        form['goal-current-amount'].value = '0';
    }

    openModal('goal-modal');
}

async function handleGoalFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const targetAmount = parseFloat(form['goal-target-amount'].value);
    const currentAmount = parseFloat(form['goal-current-amount'].value);

    if (isNaN(targetAmount) || targetAmount <= 0) {
        showMessage('goal-message', 'O valor da meta deve ser um número maior que zero.', 'error');
        return;
    }

    if (isNaN(currentAmount) || currentAmount < 0) {
        showMessage('goal-message', 'Informe quanto já guardou (zero ou mais).', 'error');
        return;
    }

    const accountId = form['goal-account'].value;
    const linkedAccountIds = accountId ? [accountId] : [];

    const data = {
        userId: currentUser.uid,
        name: form['goal-name'].value.trim(),
        targetAmount,
        currentAmount,
        goalType: (() => {
            const checked = form.querySelector('input[name="goal-type"]:checked');
            return (checked && checked.value) || 'outro';
        })(),
        linkedAccountIds
    };

    try {
        await saveGoal(data, form['goal-id'].value || null);
        closeModal('goal-modal');
        onUpdateCallback();
    } catch (error) {
        console.error('Erro ao salvar meta:', error);
        showMessage('goal-message', 'Não foi possível salvar a meta. Tente novamente.', 'error');
    }
}

async function handleGoalListClick(e) {
    const editBtn = e.target.closest('.edit-goal-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const goal = latestGoals.find((g) => g.id === id);
        if (goal) openGoalModal(goal);
        return;
    }

    const deleteButton = e.target.closest('.delete-goal-btn');
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('Tem certeza que deseja excluir este objetivo?')) {
            try {
                await deleteGoal(id);
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir meta:', error);
                alert('Não foi possível excluir a meta. Tente novamente.');
            }
        }
    }
}

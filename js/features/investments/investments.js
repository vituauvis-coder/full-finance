import { formatCurrency, isCardAccountType } from '../../core/utils.js';
import { saveInvestment, deleteInvestment } from '../../services/firestore.js';
import { openModal, closeModal, showMessage } from '../../shell/app-shell.js';
import {
    runWithButtonLoading,
    setFormSubmittingState
} from '../../core/button-loading.js';

/** Soma o valor das posições cadastradas (card do dashboard e “Posição investida”). */
export function getTotalInvestedSum(userInvestments) {
    if (!Array.isArray(userInvestments)) return 0;
    return userInvestments.reduce((sum, inv) => sum + (parseFloat(inv.currentValue) || 0), 0);
}

const CATEGORY_LABELS = {
    acao: 'Ação',
    fii: 'FII',
    renda_fixa: 'Renda fixa',
    fundo: 'Fundo',
    cripto: 'Cripto',
    outro: 'Outro'
};

const CATEGORY_ICONS = {
    acao: 'fa-chart-line',
    fii: 'fa-building',
    renda_fixa: 'fa-landmark',
    fundo: 'fa-layer-group',
    cripto: 'fa-coins',
    outro: 'fa-briefcase'
};

/** Barras decorativas na faixa superior (cena), como gráfico de performance. */
function investmentSceneBarsHtml(seed) {
    const heights = Array.from({ length: 5 }, (_, i) => {
        const n = ((seed + i * 17) % 50) + 35;
        return Math.min(94, n);
    });
    return heights.map((h) => `<span style="height:${h}%"></span>`).join('');
}

function categoryCssKey(raw) {
    return String(raw || 'outro').replace(/_/g, '-');
}

function categoryIconClass(key) {
    return CATEGORY_ICONS[key] || CATEGORY_ICONS.outro;
}

let currentUser = null;
let onUpdateCallback = null;
/** Última lista e contas para edição no modal */
let cachedInvestments = [];
let cachedAccounts = [];

export function initInvestments(user, onUpdate) {
    currentUser = user;
    onUpdateCallback = onUpdate;

    document.getElementById('add-investment-btn')?.addEventListener('click', openNewInvestmentModal);
    document.getElementById('investment-form')?.addEventListener('submit', handleInvestmentFormSubmit);
    document.getElementById('investments-list')?.addEventListener('click', handleInvestmentsListClick);
}

function categoryLabel(key) {
    return CATEGORY_LABELS[key] || key || '—';
}

export function loadInvestmentsData(userInvestments, userAccounts, currency) {
    cachedInvestments = Array.isArray(userInvestments) ? [...userInvestments] : [];
    cachedAccounts = Array.isArray(userAccounts) ? [...userAccounts] : [];

    const total = getTotalInvestedSum(cachedInvestments);
    const n = cachedInvestments.length;
    const avg = n > 0 ? total / n : 0;

    const byCat = new Map();
    cachedInvestments.forEach((inv) => {
        const key = String(inv.category || 'outro').trim() || 'outro';
        byCat.set(key, (byCat.get(key) || 0) + (parseFloat(inv.currentValue) || 0));
    });
    let topCatKey = '';
    let topCatAmt = 0;
    byCat.forEach((amt, key) => {
        if (amt > topCatAmt) {
            topCatAmt = amt;
            topCatKey = key;
        }
    });

    const elTotal = document.getElementById('investments-summary-total');
    if (elTotal) {
        elTotal.textContent = formatCurrency(total, currency);
        elTotal.removeAttribute('title');
    }

    const elCount = document.getElementById('investments-summary-count');
    if (elCount) {
        elCount.textContent = n === 0 ? '—' : String(n);
        elCount.removeAttribute('title');
    }

    const elAvg = document.getElementById('investments-summary-avg');
    if (elAvg) {
        elAvg.textContent = n === 0 ? '—' : formatCurrency(avg, currency);
        elAvg.removeAttribute('title');
    }

    const elTop = document.getElementById('investments-summary-top-cat');
    const elTopHint = document.getElementById('investments-summary-top-cat-hint');
    if (elTop) {
        elTop.textContent = topCatAmt > 0 ? formatCurrency(topCatAmt, currency) : '—';
    }
    if (elTopHint) {
        elTopHint.textContent =
            topCatAmt > 0 && topCatKey ? categoryLabel(topCatKey) : 'Nenhuma posição cadastrada';
    }

    const list = document.getElementById('investments-list');
    if (!list) return;

    list.innerHTML = '';

    if (cachedInvestments.length === 0) {
        list.innerHTML =
            '<div class="empty-state"><p>Nenhuma posição cadastrada. Clique em <strong>Novo investimento</strong> para incluir ações, FIIs, renda fixa etc.</p></div>';
        return;
    }

    cachedInvestments.forEach((inv, index) => {
        const linked = inv.linkedAccountId
            ? cachedAccounts.find((a) => a.id === inv.linkedAccountId)
            : null;
        const value = parseFloat(inv.currentValue) || 0;
        const sharePct = total > 0 ? (value / total) * 100 : 0;
        const seed =
            (inv.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + index * 17;
        const icon = categoryIconClass(inv.category);
        const footParts = [];
        if (inv.institution) {
            footParts.push(
                `<span><i class="fas fa-building" aria-hidden="true"></i> ${escapeHtml(inv.institution)}</span>`
            );
        }
        if (linked) {
            footParts.push(
                `<span><i class="fas fa-university" aria-hidden="true"></i> ${escapeHtml(linked.name)}</span>`
            );
        }
        const footHtml = footParts.length
            ? `<div class="investment-card__foot">${footParts.join('')}</div>`
            : '';

        const catClass = categoryCssKey(inv.category);
        const card = document.createElement('article');
        card.className = `investment-card investment-card--landscape investment-card--cat-${catClass} investment-card--tone-${index % 5}`;
        card.dataset.investmentId = inv.id;
        const catLabelSafe = escapeHtml(categoryLabel(inv.category));
        const nameSafe = escapeHtml(inv.name || '—');
        card.innerHTML = `
            <div class="investment-card__scene" aria-hidden="true">
                <div class="investment-card__scene-art">
                    <div class="investment-card__inv-bg"></div>
                    <div class="investment-card__inv-grid"></div>
                    <div class="investment-card__inv-trend"></div>
                    <div class="investment-card__inv-bars">${investmentSceneBarsHtml(seed)}</div>
                    <div class="investment-card__inv-donut" style="--inv-share-deg: ${(sharePct * 3.6).toFixed(2)}"></div>
                    <div class="investment-card__inv-spark"><span></span><span></span><span></span></div>
                    <div class="investment-card__scene-veil"></div>
                </div>
                <div class="investment-card__scene-overlay">
                    <span class="investment-card__badge">
                        <i class="fas ${icon}" aria-hidden="true"></i>
                        ${catLabelSafe}
                    </span>
                    <div class="investment-card__actions">
                        <button type="button" class="btn-action edit-investment-btn" data-id="${inv.id}" title="Editar investimento" aria-label="Editar"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="btn-action delete-investment-btn" data-id="${inv.id}" title="Excluir investimento" aria-label="Excluir"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="investment-card__scene-icon"><i class="fas ${icon}" aria-hidden="true"></i></div>
            </div>
            <div class="investment-card__body">
                <h3 class="investment-card__title">${nameSafe}</h3>
                <div class="investment-card__pill">
                    <span class="investment-card__pill-dot" aria-hidden="true"></span>
                    ${sharePct.toFixed(1)}% da carteira
                </div>
                <div class="investment-card__stats">
                    <div class="investment-card__stat">
                        <p class="investment-card__stat-label">Valor atual</p>
                        <p class="investment-card__stat-value investment-card__stat-value--accent">${formatCurrency(value, currency)}</p>
                    </div>
                    <div class="investment-card__stat">
                        <p class="investment-card__stat-label">Participação</p>
                        <p class="investment-card__stat-value">${sharePct.toFixed(1)}%</p>
                        <span class="investment-card__stat-hint">do total investido</span>
                    </div>
                </div>
                ${footHtml}
                ${inv.notes ? `<p class="investment-card__notes">${escapeHtml(inv.notes)}</p>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function populateLinkedAccountSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Nenhuma</option>';
    cachedAccounts
        .filter((acc) => !isCardAccountType(acc.type))
        .forEach((acc) => {
            selectEl.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)}</option>`;
        });
}

function openNewInvestmentModal() {
    const form = document.getElementById('investment-form');
    if (!form) return;
    form.reset();
    form['investment-id'].value = '';
    document.getElementById('investment-modal-title').textContent = 'Novo investimento';
    populateLinkedAccountSelect(form['investment-linked-account']);
    openModal('investment-modal');
}

function openEditInvestmentModal(id) {
    const inv = cachedInvestments.find((i) => i.id === id);
    if (!inv) return;

    const form = document.getElementById('investment-form');
    if (!form) return;

    form['investment-id'].value = inv.id;
    form['investment-name'].value = inv.name || '';
    form['investment-category'].value = inv.category || 'outro';
    form['investment-institution'].value = inv.institution || '';
    form['investment-current-value'].value = inv.currentValue != null ? inv.currentValue : '';
    form['investment-notes'].value = inv.notes || '';

    populateLinkedAccountSelect(form['investment-linked-account']);
    form['investment-linked-account'].value = inv.linkedAccountId || '';

    document.getElementById('investment-modal-title').textContent = 'Editar investimento';
    openModal('investment-modal');
}

async function handleInvestmentFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = (form['investment-name'].value || '').trim();
    const currentValue = parseFloat(form['investment-current-value'].value);

    if (!name) {
        showMessage('investment-message', 'Informe o nome do investimento.', 'error');
        return;
    }
    if (isNaN(currentValue) || currentValue < 0) {
        showMessage('investment-message', 'Informe um valor atual válido (maior ou igual a zero).', 'error');
        return;
    }

    const linked = form['investment-linked-account'].value;
    const data = {
        userId: currentUser.uid,
        name,
        category: form['investment-category'].value || 'outro',
        institution: (form['investment-institution'].value || '').trim() || null,
        currentValue,
        notes: (form['investment-notes'].value || '').trim() || null,
        linkedAccountId: linked || null
    };

    setFormSubmittingState(form, true, 'Salvando investimento...');
    try {
        await saveInvestment(data, form['investment-id'].value || null);
        closeModal('investment-modal');
        onUpdateCallback();
    } catch (error) {
        console.error('Erro ao salvar investimento:', error);
        showMessage('investment-message', 'Não foi possível salvar o investimento. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function handleInvestmentsListClick(e) {
    const delBtn = e.target.closest('.delete-investment-btn');
    if (delBtn) {
        const id = delBtn.dataset.id;
        if (id && confirm('Excluir esta posição de investimento?')) {
            try {
                await runWithButtonLoading(delBtn, () => deleteInvestment(id));
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir investimento:', error);
                alert('Não foi possível excluir. Tente novamente.');
            }
        }
        return;
    }

    const editBtn = e.target.closest('.edit-investment-btn');
    if (editBtn && editBtn.dataset.id) {
        openEditInvestmentModal(editBtn.dataset.id);
    }
}

import { formatCurrency } from '../../core/utils.js';
import { api } from '../../api-client.js';
import { openModal, closeModal } from '../../shell/app-shell.js';
import {
    runWithButtonLoading,
    setFormSubmittingState
} from '../../core/button-loading.js';
import { playTrashSound } from '../../core/ui-sounds.js';

// Estado do kanban
let kanbanCards = [];

/** API pode devolver `type`/`Type`; normaliza para bug | melhoria | melhoria_rapida */
function normalizeKanbanTypeString(raw) {
    const s = String(raw ?? '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    if (s === 'bug') return 'bug';
    if (s === 'melhoria_rapida' || s === 'melhoriarapida') return 'melhoria_rapida';
    return 'melhoria';
}

function normalizeKanbanCard(card) {
    return { ...card, type: normalizeKanbanTypeString(card?.type ?? card?.Type) };
}

function kanbanCardModifierClass(type) {
    if (type === 'bug') return 'kanban-card--bug';
    if (type === 'melhoria_rapida') return 'kanban-card--melhoria-rapida';
    return 'kanban-card--melhoria';
}

const KANBAN_KIND_LABEL = {
    bug: 'Bug',
    melhoria: 'Melhoria',
    melhoria_rapida: 'Melhoria rápida'
};

/**
 * Inicializa os listeners da página de ferramentas (calculadora e kanban).
 */
export function initTools() {
    document.getElementById('compound-interest-form')?.addEventListener('submit', calculateCompoundInterest);

    // Inicializar kanban
    initKanban();
}

// --- Calculadora de Juros Compostos ---
function calculateCompoundInterest(e) {
    e.preventDefault();
    const form = e.target;
    const initialAmount = parseFloat(form['initial-amount'].value) || 0;
    const monthlyContribution = parseFloat(form['monthly-contribution'].value) || 0;
    const annualRate = parseFloat(form['interest-rate'].value) || 0;
    const years = parseFloat(form['period-years'].value) || 0;

    if (initialAmount < 0 || monthlyContribution < 0 || annualRate < 0 || years < 0) {
        alert('Os valores para o cálculo de juros compostos não podem ser negativos.');
        return;
    }

    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;

    let finalAmount = initialAmount * Math.pow(1 + monthlyRate, months);
    if (monthlyRate > 0) {
        finalAmount += monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    }

    const totalInvested = initialAmount + (monthlyContribution * months);
    const totalInterest = finalAmount - totalInvested;

    document.getElementById('total-invested').textContent = formatCurrency(totalInvested);
    document.getElementById('total-interest').textContent = formatCurrency(totalInterest);
    document.getElementById('final-amount').textContent = formatCurrency(finalAmount);
    document.getElementById('calculator-results').classList.remove('hidden');
}

// --- Kanban de Sugestões ---

function initKanban() {
    // Botão nova sugestão
    document.getElementById('btn-add-kanban-card')?.addEventListener('click', () => openKanbanModal());

    // Modal - fechar
    document.getElementById('kanban-modal-cancel')?.addEventListener('click', () => closeModal('kanban-modal'));

    // Form
    document.getElementById('kanban-form')?.addEventListener('submit', saveKanbanCard);

    // Tabs de tipo (Bug/Melhoria)
    document.querySelectorAll('.kanban-tab-btn')?.forEach(btn => {
        btn.addEventListener('click', () =>
            switchKanbanTypeTab(normalizeKanbanTypeString(btn.dataset.type))
        );
    });

    // Upload de imagem - Bug
    document.getElementById('kanban-card-image-bug')?.addEventListener('change', (e) => handleKanbanImageUpload(e, 'bug'));
    document.getElementById('kanban-remove-image-bug')?.addEventListener('click', () => clearKanbanImage('bug'));

    // Upload de imagem - Melhoria / Melhoria rápida
    document.getElementById('kanban-card-image-melhoria')?.addEventListener('change', (e) => handleKanbanImageUpload(e, 'melhoria'));
    document.getElementById('kanban-remove-image-melhoria')?.addEventListener('click', () => clearKanbanImage('melhoria'));

    document.getElementById('kanban-card-image-melhoria-rapida')?.addEventListener('change', (e) =>
        handleKanbanImageUpload(e, 'melhoria-rapida')
    );
    document.getElementById('kanban-remove-image-melhoria-rapida')?.addEventListener('click', () =>
        clearKanbanImage('melhoria-rapida')
    );

    // Drag and Drop - configurar colunas
    setupKanbanDragAndDrop();

    // Carregar cards
    loadKanbanCards();
}

function switchKanbanTypeTab(type) {
    const t = normalizeKanbanTypeString(type);
    const validTypes = ['bug', 'melhoria', 'melhoria_rapida'];
    if (!validTypes.includes(t)) return;

    document.querySelectorAll('.kanban-tab-btn').forEach(btn => {
        btn.classList.toggle('active', normalizeKanbanTypeString(btn.dataset.type) === t);
    });

    document.getElementById('kanban-card-type').value = t;

    document.getElementById('kanban-bug-fields').classList.toggle('hidden', t !== 'bug');
    document.getElementById('kanban-melhoria-fields').classList.toggle('hidden', t !== 'melhoria');
    document.getElementById('kanban-melhoria-rapida-fields').classList.toggle('hidden', t !== 'melhoria_rapida');

    const titleInput = document.getElementById('kanban-card-title');
    if (t === 'bug') {
        titleInput.placeholder = 'Resumo do bug (ex: Erro ao salvar formulário)';
    } else if (t === 'melhoria') {
        titleInput.placeholder = 'Resumo da melhoria (ex: Adicionar filtro por data)';
    } else {
        titleInput.placeholder = 'Título curto (ex: Ideia para relatório mensal)';
    }
}

function setupKanbanDragAndDrop() {
    const columns = ['backlog', 'ativo', 'teste', 'finalizado'];

    columns.forEach(colId => {
        const column = document.getElementById(`kanban-${colId}`);
        if (!column) return;

        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');

            const cardId = e.dataTransfer.getData('text/plain');
            const newColumn = colId;

            if (cardId && newColumn) {
                const card = kanbanCards.find(c => c.id === cardId);
                if (card && card.column !== newColumn) {
                    moveKanbanCard(cardId, newColumn);
                }
            }
        });
    });
}

async function loadKanbanCards() {
    try {
        const cards = await api('/api/kanban-cards');
        kanbanCards = Array.isArray(cards) ? cards.map(normalizeKanbanCard) : [];
        renderKanbanCards();
    } catch (error) {
        console.error('Erro ao carregar kanban cards:', error);
    }
}

function renderKanbanCards() {
    const columns = ['backlog', 'ativo', 'teste', 'finalizado'];

    // Limpar todas as colunas
    columns.forEach(col => {
        const container = document.getElementById(`kanban-${col}`);
        if (container) container.innerHTML = '';
    });

    // Contadores
    const counts = { backlog: 0, ativo: 0, teste: 0, finalizado: 0 };

    // Renderizar cards
    kanbanCards.forEach(card => {
        const cardElement = createKanbanCardElement(card);
        const container = document.getElementById(`kanban-${card.column}`);
        if (container) {
            container.appendChild(cardElement);
            counts[card.column]++;
        }
    });

    // Atualizar contadores
    columns.forEach(col => {
        const countEl = document.querySelector(`.kanban-column-count[data-column="${col}"]`);
        if (countEl) countEl.textContent = counts[col];
    });
}

function createKanbanCardElement(card) {
    const div = document.createElement('div');
    const ctype = normalizeKanbanTypeString(card.type);
    div.className = `kanban-card ${kanbanCardModifierClass(ctype)}`;
    div.dataset.id = card.id;
    div.dataset.type = ctype;
    div.draggable = true;

    // Eventos de drag
    div.addEventListener('dragstart', (e) => {
        div.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
    });

    const authorName = card.creator?.name || card.creator?.email || 'Usuário';
    const dateStr = new Date(card.createdAt).toLocaleDateString('pt-BR');
    const kindLabel = KANBAN_KIND_LABEL[ctype] || KANBAN_KIND_LABEL.melhoria;

    div.innerHTML = `
        <span class="kanban-card-kind">${escapeHtml(kindLabel)}</span>
        ${card.image ? `<div class="kanban-card-image"><img src="${escapeHtml(card.image)}" alt="Imagem" class="kanban-card-thumbnail"></div>` : ''}
        <div class="kanban-card-title">${escapeHtml(card.title)}</div>
        ${card.screen ? `<div class="kanban-card-screen"><i class="fas fa-desktop"></i> ${escapeHtml(card.screen)}</div>` : ''}
        ${card.description ? `<div class="kanban-card-description">${escapeHtml(card.description)}</div>` : ''}
        <div class="kanban-card-meta">
            <div class="kanban-card-author">
                <i class="fas fa-user"></i> ${escapeHtml(authorName)}
            </div>
            <span>${dateStr}</span>
        </div>
        <div class="kanban-card-actions">
            <button class="kanban-card-btn edit" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="kanban-card-btn delete" title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="kanban-card-move">
            <button data-move="backlog" ${card.column === 'backlog' ? 'disabled' : ''}>Backlog</button>
            <button data-move="ativo" ${card.column === 'ativo' ? 'disabled' : ''}>Ativo</button>
            <button data-move="teste" ${card.column === 'teste' ? 'disabled' : ''}>Teste</button>
            <button data-move="finalizado" ${card.column === 'finalizado' ? 'disabled' : ''}>Finalizado</button>
        </div>
    `;

    // Eventos
    div.querySelector('.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openKanbanModal(card);
    });

    div.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteKanbanCard(card.id, e.currentTarget);
    });

    // Clique na imagem para ampliar
    div.querySelector('.kanban-card-thumbnail')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openKanbanImageModal(card.image);
    });

    // Clique no card para visualizar (não nos botões)
    div.addEventListener('click', (e) => {
        // Ignorar se clicou em um botão ou na área de movimento
        if (e.target.closest('.kanban-card-actions') || e.target.closest('.kanban-card-move')) {
            return;
        }
        openKanbanViewModal(card);
    });

    div.querySelectorAll('.kanban-card-move button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newColumn = btn.dataset.move;
            if (newColumn && newColumn !== card.column) {
                moveKanbanCard(card.id, newColumn, btn);
            }
        });
    });

    return div;
}

function openKanbanModal(card = null) {
    const titleEl = document.getElementById('kanban-modal-title');
    const form = document.getElementById('kanban-form');

    clearKanbanImage('bug');
    clearKanbanImage('melhoria');
    clearKanbanImage('melhoria-rapida');

    if (card) {
        const ctype = normalizeKanbanTypeString(card.type ?? card.Type);
        const isBug = ctype === 'bug';
        const isRapida = ctype === 'melhoria_rapida';
        if (isBug) {
            titleEl.innerHTML = '<i class="fas fa-bug"></i> Editar Bug';
        } else if (isRapida) {
            titleEl.innerHTML = '<i class="fas fa-bolt"></i> Editar melhoria rápida';
        } else {
            titleEl.innerHTML = '<i class="fas fa-lightbulb"></i> Editar Melhoria';
        }
        document.getElementById('kanban-card-id').value = card.id;
        document.getElementById('kanban-card-title').value = card.title;

        switchKanbanTypeTab(ctype);

        document.getElementById('kanban-melhoria-desc').value = '';
        document.getElementById('kanban-melhoria-benefit').value = '';
        document.getElementById('kanban-melhoria-rapida-desc').value = '';
        document.getElementById('kanban-bug-screen').value = '';
        document.getElementById('kanban-bug-steps').value = '';
        document.getElementById('kanban-bug-expected').value = '';
        document.getElementById('kanban-bug-actual').value = '';

        if (isBug) {
            document.getElementById('kanban-bug-screen').value = card.screen || '';
            document.getElementById('kanban-bug-steps').value = card.steps || '';
            document.getElementById('kanban-bug-expected').value = card.expected || '';
            document.getElementById('kanban-bug-actual').value = card.actual || '';
        } else if (isRapida) {
            document.getElementById('kanban-melhoria-rapida-desc').value = card.description || '';
        } else {
            document.getElementById('kanban-melhoria-desc').value = card.description || '';
            document.getElementById('kanban-melhoria-benefit').value = card.benefit || '';
        }

        if (card.image) {
            document.getElementById('kanban-card-image-data').value = card.image;
            if (isBug) showKanbanImagePreview(card.image, 'bug');
            else if (isRapida) showKanbanImagePreview(card.image, 'melhoria-rapida');
            else showKanbanImagePreview(card.image, 'melhoria');
        }
    } else {
        titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Item';
        form.reset();
        document.getElementById('kanban-card-id').value = '';
        switchKanbanTypeTab('bug'); // Default para bug
    }

    openModal('kanban-modal');
}

async function saveKanbanCard(e) {
    e.preventDefault();
    const form = e.target;

    const id = document.getElementById('kanban-card-id').value;
    const type = document.getElementById('kanban-card-type').value;
    const title = document.getElementById('kanban-card-title').value.trim();
    const image = document.getElementById('kanban-card-image-data').value;
    const existing = id ? kanbanCards.find(c => c.id === id) : null;
    const column = existing?.column ?? 'backlog';

    if (!title) {
        alert('Título é obrigatório');
        return;
    }

    // Montar payload baseado no tipo
    let payload = { type, title, column, image };

    if (type === 'bug') {
        const screen = document.getElementById('kanban-bug-screen').value.trim();
        const steps = document.getElementById('kanban-bug-steps').value.trim();
        const expected = document.getElementById('kanban-bug-expected').value.trim();
        const actual = document.getElementById('kanban-bug-actual').value.trim();

        if (!screen) {
            alert('Tela onde ocorre o bug é obrigatória');
            return;
        }
        if (!steps) {
            alert('Passos para reproduzir são obrigatórios');
            return;
        }
        if (!actual) {
            alert('Comportamento atual é obrigatório');
            return;
        }

        payload = { ...payload, screen, steps, expected, actual };
    } else if (type === 'melhoria_rapida') {
        const description = document.getElementById('kanban-melhoria-rapida-desc').value.trim();
        if (!description) {
            alert('Descrição é obrigatória');
            return;
        }
        payload = { ...payload, description, benefit: null };
    } else {
        const description = document.getElementById('kanban-melhoria-desc').value.trim();
        const benefit = document.getElementById('kanban-melhoria-benefit').value.trim();

        if (!description) {
            alert('Descrição da melhoria é obrigatória');
            return;
        }

        payload = { ...payload, description, benefit };
    }

    setFormSubmittingState(form, true, 'Salvando...');
    try {
        if (id) {
            // Editar
            await api(`/api/kanban-cards/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Criar
            await api('/api/kanban-cards', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        closeModal('kanban-modal');
        await loadKanbanCards();
    } catch (error) {
        console.error('Erro ao salvar kanban card:', error);
        alert('Erro ao salvar. Tente novamente.');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function deleteKanbanCard(id, btn = null) {
    if (!confirm('Tem certeza que deseja excluir esta sugestão?')) return;

    try {
        if (btn) {
            await runWithButtonLoading(btn, () => api(`/api/kanban-cards/${id}`, { method: 'DELETE' }));
        } else {
            await api(`/api/kanban-cards/${id}`, { method: 'DELETE' });
        }
        playTrashSound();
        await loadKanbanCards();
    } catch (error) {
        console.error('Erro ao deletar kanban card:', error);
        alert('Erro ao excluir. Tente novamente.');
    }
}

async function moveKanbanCard(id, newColumn, btn = null) {
    try {
        if (btn) {
            await runWithButtonLoading(
                btn,
                () =>
                    api(`/api/kanban-cards/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ column: newColumn })
                    })
            );
        } else {
            await api(`/api/kanban-cards/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ column: newColumn })
            });
        }
        await loadKanbanCards();
    } catch (error) {
        console.error('Erro ao mover kanban card:', error);
        alert('Erro ao mover card. Tente novamente.');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Funções de Imagem do Kanban ---

function handleKanbanImageUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem válida (JPG, PNG, GIF)');
        e.target.value = '';
        return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('Imagem muito grande. Tamanho máximo: 2MB');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        document.getElementById('kanban-card-image-data').value = base64;
        showKanbanImagePreview(base64, type);
    };
    reader.onerror = () => {
        alert('Erro ao ler imagem. Tente novamente.');
    };
    reader.readAsDataURL(file);
}

function showKanbanImagePreview(base64, type) {
    const suffix = type ? `-${type}` : '';
    const previewContainer = document.getElementById(`kanban-image-preview${suffix}`);
    const img = document.getElementById(`kanban-preview-img${suffix}`);

    if (img) img.src = base64;
    if (previewContainer) previewContainer.classList.remove('hidden');
}

function clearKanbanImage(type) {
    const suffix = type ? `-${type}` : '';
    const input = document.getElementById(`kanban-card-image${suffix}`);
    const dataInput = document.getElementById('kanban-card-image-data');
    const previewContainer = document.getElementById(`kanban-image-preview${suffix}`);
    const img = document.getElementById(`kanban-preview-img${suffix}`);

    if (input) input.value = '';
    if (dataInput) dataInput.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (img) img.src = '';
}

function openKanbanImageModal(imageUrl) {
    const img = document.getElementById('kanban-viewer-img');
    if (img) img.src = imageUrl;
    openModal('kanban-image-modal');
}

function openKanbanViewModal(card) {
    const ctype = normalizeKanbanTypeString(card.type ?? card.Type);
    const isBug = ctype === 'bug';
    const isRapida = ctype === 'melhoria_rapida';
    const columnNames = { backlog: 'Backlog', ativo: 'Ativo', teste: 'Teste', finalizado: 'Finalizado' };

    const typeEl = document.getElementById('kanban-view-card-type');
    if (isBug) typeEl.textContent = '🐛 Bug';
    else if (isRapida) typeEl.textContent = '⚡ Melhoria rápida';
    else typeEl.textContent = '💡 Melhoria';
    typeEl.dataset.type = ctype;

    const columnEl = document.getElementById('kanban-view-card-column');
    columnEl.textContent = columnNames[card.column] || card.column;
    columnEl.dataset.column = card.column;

    document.getElementById('kanban-view-card-date').textContent = new Date(card.createdAt).toLocaleDateString('pt-BR');

    // Imagem
    const imageContainer = document.getElementById('kanban-view-card-image-container');
    const imageEl = document.getElementById('kanban-view-card-image');
    if (card.image) {
        imageEl.src = card.image;
        imageContainer.classList.remove('hidden');
        imageEl.onclick = () => openKanbanImageModal(card.image);
    } else {
        imageContainer.classList.add('hidden');
        imageEl.src = '';
    }

    // Título
    document.getElementById('kanban-view-card-title').textContent = card.title || '-';

    // Mostrar/esconder campos específicos
    document.getElementById('kanban-view-bug-fields').classList.toggle('hidden', !isBug);
    document.getElementById('kanban-view-melhoria-fields').classList.toggle('hidden', isBug);
    document.getElementById('kanban-view-benefit-row').classList.toggle('hidden', isRapida);

    if (isBug) {
        document.getElementById('kanban-view-screen').textContent = card.screen || '-';
        document.getElementById('kanban-view-steps').textContent = card.steps || '-';
        document.getElementById('kanban-view-expected').textContent = card.expected || '-';
        document.getElementById('kanban-view-actual').textContent = card.actual || '-';
    } else {
        document.getElementById('kanban-view-melhoria-desc').textContent = card.description || '-';
        document.getElementById('kanban-view-benefit').textContent = card.benefit || '-';
    }

    // Autor
    const authorName = card.creator?.name || card.creator?.email || 'Usuário';
    document.getElementById('kanban-view-card-author').textContent = `Por: ${authorName}`;

    // Botão editar
    document.getElementById('kanban-view-edit-btn').onclick = () => {
        closeModal('kanban-view-modal');
        openKanbanModal(card);
    };

    openModal('kanban-view-modal');
}

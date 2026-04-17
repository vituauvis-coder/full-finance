/**
 * Categorias de despesa: gerenciadas via API (banco de dados)
 * Substitui o armazenamento localStorage pelo banco de dados
 */

import {
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory
} from '../../services/category-service.js';
import { populateGainCategorySelect } from './gain-categories.js';

// Cache local das categorias
let categoriesCache = null;
let categoriesCacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minuto

const ADD_NEW_VALUE = '__add_new__';

/** Placeholder da descrição conforme a categoria (exemplos em pt-BR). */
export const EXPENSE_DESCRIPTION_PLACEHOLDERS = {
    Alimentação: 'Ex.: temaki no restaurante X, almoço no trabalho, lanche na padaria…',
    Moradia: 'Ex.: aluguel Apt 101, condomínio Maio, taxa de lixo…',
    Transporte: 'Ex.: Uber aeroporto, gasolina Posto Z, passagem de metrô…',
    Saúde: 'Ex.: consulta cardiologista, remédio farmácia Y, exame laboratório…',
    Educação: 'Ex.: mensalidade curso Y, livro Z, material para prova…',
    Lazer: 'Ex.: cinema no shopping, ingresso show, bar com amigos…',
    Supermercado: 'Ex.: compra mensal Carrefour, hortifruti semanal…',
    Assinaturas: 'Ex.: Netflix família, Spotify, Adobe Creative Cloud…',
    Roupas: 'Ex.: tênis na loja X, camisa social outlet…',
    Pets: 'Ex.: ração Golden, consulta vet Dr. Silva, remédio antipulgas…',
    Viagens: 'Ex.: hotel em Floripa, passagem aérea LATAM…',
    Investimentos: 'Ex.: taxa corretora, IOF câmbio, custódia B3…',
    Trabalho: 'Ex.: licença software, coworking, material de escritório…',
    Seguros: 'Ex.: seguro auto parcela 3, seguro residencial anual…',
    Empréstimo: 'Ex.: empréstimo pessoal banco X, refinanciamento, consignado…',
    Outros: 'Ex.: descreva o gasto (o que foi, onde, quando…)'
};

const PLACEHOLDER_NO_CATEGORY =
    'Escolha uma categoria acima; o exemplo de descrição muda conforme o tipo de saída.';

const PLACEHOLDER_CUSTOM_CATEGORY =
    'Ex.: descreva o gasto nesta categoria (o que comprou, onde, quando…).';

/**
 * Texto de placeholder sugerido para o campo descrição, conforme a categoria.
 * @param {string} [categoryLabel]
 */
export function getExpenseDescriptionPlaceholder(categoryLabel) {
    const key = categoryLabel != null ? String(categoryLabel).trim() : '';
    if (!key) return PLACEHOLDER_NO_CATEGORY;
    if (EXPENSE_DESCRIPTION_PLACEHOLDERS[key]) return EXPENSE_DESCRIPTION_PLACEHOLDERS[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(EXPENSE_DESCRIPTION_PLACEHOLDERS)) {
        if (k.toLowerCase() === lower) return v;
    }
    return PLACEHOLDER_CUSTOM_CATEGORY;
}

/** Atualiza o placeholder de `#expense-description` com base em `#expense-category-select`. */
export function syncExpenseDescriptionPlaceholder() {
    const sel = document.getElementById('expense-category-select');
    const input = document.getElementById('expense-description');
    if (!input) return;
    const cat = sel?.value?.trim() || '';
    input.placeholder = getExpenseDescriptionPlaceholder(cat);
}

export function getCustomExpenseCategories() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

export function getCustomSubcategories() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SUBS);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        if (typeof obj !== 'object' || obj === null) return {};
        const result = {};
        for (const [category, subs] of Object.entries(obj)) {
            if (Array.isArray(subs)) {
                result[category] = subs.map((s) => String(s).trim()).filter(Boolean);
            }
        }
        return result;
    } catch {
        return {};
    }
}

function saveCustomExpenseCategories(list) {
    const uniq = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(uniq));
    } catch {
        /* ignore */
    }
}

function saveCustomSubcategories(subcategories) {
    try {
        localStorage.setItem(STORAGE_KEY_SUBS, JSON.stringify(subcategories));
    } catch {
        /* ignore */
    }
}

export async function addCustomExpenseCategory(name) {
    const n = String(name).trim();
    if (!n) return { ok: false, reason: 'empty' };
    
    try {
        const result = await createCategory(n);
        // Atualiza o cache
        categoriesCache = null;
        await loadCategoriesFromDatabase();
        return { ok: true, duplicate: false, category: result };
    } catch (err) {
        if (err.message.includes('já existe')) {
            return { ok: true, duplicate: true };
        }
        return { ok: false, reason: err.message };
    }
}

export async function addCustomSubcategory(category, subcategoryName) {
    const cat = String(category).trim();
    const sub = String(subcategoryName).trim();
    if (!cat || !sub) return { ok: false, reason: 'empty' };
    
    // Busca a categoria no cache
    const categoryObj = categoriesCache?.find(c => c.name === cat);
    if (!categoryObj) return { ok: false, reason: 'category_not_found' };
    
    try {
        const result = await createSubcategory(categoryObj.id, sub);
        // Atualiza o cache
        categoriesCache = null;
        await loadCategoriesFromDatabase();
        return { ok: true, duplicate: false, subcategory: result };
    } catch (err) {
        if (err.message.includes('já existe')) {
            return { ok: true, duplicate: true };
        }
        return { ok: false, reason: err.message };
    }
}

export async function getSubcategoriesForCategory(category) {
    const cat = String(category).trim();
    if (!cat) return [];
    
    if (!categoriesCache) {
        await loadCategoriesFromDatabase();
    }
    
    const categoryObj = categoriesCache?.find(c => c.name === cat);
    if (!categoryObj || !categoryObj.subcategories) {
        return [];
    }
    
    return categoryObj.subcategories
        .map(s => s.name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Busca todas as categorias do banco de dados
 * @param {boolean} [force] — ignorar cache (após criar/editar/excluir)
 * @returns {Promise<Array>} Lista de categorias
 */
export async function loadCategoriesFromDatabase(force = false) {
    try {
        const now = Date.now();
        if (!force && categoriesCache && (now - categoriesCacheTimestamp) < CACHE_TTL) {
            return categoriesCache;
        }
        categoriesCache = await fetchCategories();
        categoriesCacheTimestamp = now;
        return categoriesCache;
    } catch (err) {
        console.error('Erro ao carregar categorias:', err);
        return [];
    }
}

/**
 * Retorna todas as categorias (do cache)
 * @returns {Array}
 */
export function getAllExpenseCategoriesSorted() {
    if (!categoriesCache) return [];
    return categoriesCache
        .map(c => c.name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Preenche o <select> de categoria da despesa.
 * @param {string} [selectedValue] - valor a selecionar (ex.: ao editar)
 * @param {boolean} [forceRefresh] - buscar lista no servidor (ignorar cache)
 */
export async function populateExpenseCategorySelect(selectedValue = '', forceRefresh = false) {
    const sel = document.getElementById('expense-category-select');
    if (!sel) return;
    
    await loadCategoriesFromDatabase(forceRefresh);
    
    // Filtra apenas categorias do tipo EXPENSE
    const cats = categoriesCache
        ?.filter(c => c.type === 'EXPENSE' || !c.type) // Inclui sem tipo como EXPENSE (padrão)
        ?.map(c => c.name)
        ?.sort((a, b) => a.localeCompare(b, 'pt-BR')) || [];
    
    sel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Selecione uma categoria';
    sel.appendChild(ph);

    cats.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
    });

    // Adiciona espaçador
    const spacerOpt = document.createElement('option');
    spacerOpt.value = '';
    spacerOpt.textContent = '─────────────────';
    spacerOpt.disabled = true;
    spacerOpt.style.color = '#e5e7eb';
    spacerOpt.style.fontSize = '0.8rem';
    sel.appendChild(spacerOpt);

    // Adiciona opção de gerenciar categorias
    const manageOpt = document.createElement('option');
    manageOpt.value = '__manage_categories__';
    manageOpt.textContent = '⚙️ Gerenciar categorias...';
    sel.appendChild(manageOpt);

    // Adiciona opção de adicionar nova categoria
    const addOpt = document.createElement('option');
    addOpt.value = ADD_NEW_VALUE;
    addOpt.textContent = '➕ Adicionar nova categoria...';
    sel.appendChild(addOpt);

    if (selectedValue) {
        const exists = [...sel.options].some((o) => o.value === selectedValue);
        if (!exists) {
            const opt = document.createElement('option');
            opt.value = selectedValue;
            opt.textContent = selectedValue;
            sel.insertBefore(opt, addOpt);
        }
        sel.value = selectedValue;
    }
    syncExpenseDescriptionPlaceholder();
    // Atualiza subcategorias quando a categoria muda
    await populateExpenseSubcategorySelect();
}

/**
 * Preenche o &lt;select&gt; de subcategoria da despesa.
 * @param {string} [selectedValue] - valor a selecionar (ex.: ao editar)
 * @param {boolean} [forceRefresh] - buscar categorias no servidor (ignorar cache)
 */
export async function populateExpenseSubcategorySelect(selectedValue = '', forceRefresh = false) {
    const catSel = document.getElementById('expense-category-select');
    const subSel = document.getElementById('expense-subcategory-select');
    if (!subSel) return;

    await loadCategoriesFromDatabase(forceRefresh);
    
    const selectedCategory = catSel?.value || '';
    const subcats = selectedCategory ? await getSubcategoriesForCategory(selectedCategory) : [];
    
    subSel.innerHTML = '';
    
    // Desabilita se não houver categoria selecionada
    subSel.disabled = !selectedCategory;
    
    // Placeholder informativo
    const ph = document.createElement('option');
    ph.value = '';
    if (!selectedCategory) {
        ph.textContent = 'Selecione uma categoria primeiro';
    } else {
        ph.textContent = 'Selecione uma subcategoria';
    }
    subSel.appendChild(ph);
    
    subcats.forEach((sub) => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        subSel.appendChild(opt);
    });
    
    if (selectedCategory) {
        // Adiciona espaçador
        const spacerOpt = document.createElement('option');
        spacerOpt.value = '';
        spacerOpt.textContent = '─────────────────';
        spacerOpt.disabled = true;
        spacerOpt.style.color = '#e5e7eb';
        spacerOpt.style.fontSize = '0.8rem';
        subSel.appendChild(spacerOpt);
        
        // Adiciona opção de gerenciar subcategorias
        const manageOpt = document.createElement('option');
        manageOpt.value = '__manage_subcategories__';
        manageOpt.textContent = '⚙️ Gerenciar subcategorias...';
        subSel.appendChild(manageOpt);
        
        // Adiciona opção de adicionar nova subcategoria
        const addOpt = document.createElement('option');
        addOpt.value = ADD_NEW_VALUE;
        addOpt.textContent = '➕ Adicionar nova subcategoria...';
        subSel.appendChild(addOpt);
    }
    
    if (selectedValue && subcats.includes(selectedValue)) {
        subSel.value = selectedValue;
    }
}

let expenseCategoryUiBound = false;

/** Liga o bloco "nova categoria" e o envio por Enter no input. Chamar uma vez (ex.: initFinance). */
export function setupExpenseCategoryUi() {
    if (expenseCategoryUiBound) return;
    expenseCategoryUiBound = true;

    const sel = document.getElementById('expense-category-select');
    
    // Elementos de subcategoria
    const subSel = document.getElementById('expense-subcategory-select');
    const subNewRow = document.getElementById('expense-subcategory-new-row');
    const subNewInput = document.getElementById('expense-subcategory-new-input');
    const subSaveBtn = document.getElementById('expense-subcategory-new-save');
    const subCancelBtn = document.getElementById('expense-subcategory-new-cancel');
    
    if (!sel) return;

    sel.addEventListener('change', async () => {
        console.log('Categoria selecionada:', sel.value);
        if (sel.value === ADD_NEW_VALUE) {
            console.log('Abrindo modal para nova categoria...');
            sel.value = '';
            syncExpenseDescriptionPlaceholder();
            // Abre modal para adicionar nova categoria
            window.openCategoryFormModal();
        } else if (sel.value === '__manage_categories__') {
            console.log('Abrindo modal de gerenciamento...');
            sel.value = '';
            syncExpenseDescriptionPlaceholder();
            // Abre modal de gerenciamento
            openManageCategoriesModal();
        } else {
            syncExpenseDescriptionPlaceholder();
        }
        // Atualiza subcategorias quando a categoria muda
        await populateExpenseSubcategorySelect();
    });
    
    // Eventos para subcategorias
    if (subSel) {
        subSel.addEventListener('change', () => {
            console.log('Subcategoria selecionada:', subSel.value);
            if (subSel.value === ADD_NEW_VALUE) {
                console.log('Abrindo modal para nova subcategoria...');
                const selectedCategory = sel?.value?.trim();
                console.log('Categoria selecionada no select:', selectedCategory);
                console.log('Cache de categorias:', categoriesCache);
                
                const categoryObj = categoriesCache?.find(c => c.name === selectedCategory);
                console.log('Objeto categoria encontrado:', categoryObj);
                
                if (!selectedCategory || !categoryObj) {
                    console.error('Erro - Categoria não selecionada ou não encontrada:', { selectedCategory, categoryObj });
                    alert('Selecione uma categoria primeiro');
                    return;
                }
                
                subSel.value = '';
                // Abre modal para adicionar nova subcategoria
                window.openSubcategoryFormModal(categoryObj.id, selectedCategory);
            } else if (subSel.value === '__manage_subcategories__') {
                console.log('Abrindo modal de gerenciamento de subcategorias...');
                subSel.value = '';
                // Abre modal de gerenciamento (mostra todas categorias com subcategorias)
                openManageCategoriesModal();
            }
        });
        
        function hideSubNewRow() {
            subNewRow?.classList.add('hidden');
            if (subNewInput) subNewInput.value = '';
        }
    
        async function saveNewSubcategory() {
            const name = subNewInput?.value?.trim();
            const category = sel?.value?.trim();
            if (!name || !category) return;
            const result = await addCustomSubcategory(category, name);
            if (result.ok) {
                populateExpenseSubcategorySelect(name, true);
                hideSubNewRow();
            }
        }
    
        subCancelBtn?.addEventListener('click', hideSubNewRow);
        subSaveBtn?.addEventListener('click', () => saveNewSubcategory());
        subNewInput?.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveNewSubcategory();
            }
        });
    }
    
    // Botão de gerenciamento de categorias
    const manageBtn = document.getElementById('manage-categories-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', openManageCategoriesModal);
    }
}

// ==================== GERENCIAMENTO DE CATEGORIAS ====================

let editingCategoryId = null;

/** Abre o modal de gerenciamento de categorias */
export async function openManageCategoriesModal() {
    const modal = document.getElementById('manage-categories-modal');
    if (!modal) return;
    
    await renderCategoriesList();
    modal.classList.remove('hidden');
    
    // Botão de adicionar nova categoria
    const addBtn = document.getElementById('add-new-category-btn');
    if (addBtn) {
        addBtn.onclick = () => openCategoryFormModal();
    }
    
    // Fechar modal
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };
}

/** Abre o modal de formulário de categoria (adicionar ou editar) */
function openCategoryFormModal(categoryId = null, categoryName = '', categoryType = 'EXPENSE') {
    console.log('openCategoryFormModal chamado com:', { categoryId, categoryName, categoryType });
    const formModal = document.getElementById('category-form-modal');
    const title = document.getElementById('category-form-title');
    const input = document.getElementById('category-name-input');
    const typeSelect = document.getElementById('category-type-select');
    const saveBtn = document.getElementById('category-save-btn');
    const cancelBtn = document.getElementById('category-cancel-btn');
    
    console.log('Elementos encontrados:', { formModal, title, input, typeSelect, saveBtn, cancelBtn });
    
    if (!formModal) {
        console.error('Modal de categoria não encontrado!');
        return;
    }
    
    editingCategoryId = categoryId;
    title.textContent = categoryId ? 'Editar Categoria' : 'Nova Categoria';
    input.value = categoryName || '';
    if (typeSelect) typeSelect.value = categoryType || 'EXPENSE';
    formModal.classList.remove('hidden');
    
    console.log('Modal deve estar visível');
    
    // Foco no input
    setTimeout(() => input?.focus(), 100);
    
    // Salvar
    saveBtn.onclick = async () => {
        const name = input.value.trim();
        const type = typeSelect?.value || 'EXPENSE';
        if (!name) {
            alert('Digite um nome para a categoria');
            return;
        }
        
        if (editingCategoryId) {
            try {
                await updateCategory(editingCategoryId, name, type);
                formModal.classList.add('hidden');
                await renderCategoriesList();
                if (type === 'GAIN') {
                    await populateGainCategorySelect(name, true);
                } else {
                    await populateExpenseCategorySelect(name, true);
                }
            } catch (err) {
                alert(err?.message || 'Erro ao atualizar categoria');
            }
        } else {
            const result = await createCategory(name, type);
            if (result.id) {
                formModal.classList.add('hidden');
                await renderCategoriesList();
                if (type === 'GAIN') {
                    await populateGainCategorySelect(name, true);
                } else {
                    await populateExpenseCategorySelect(name, true);
                }
            } else if (result.error?.includes('já existe')) {
                alert('Esta categoria já existe');
            } else {
                alert(result.error || 'Erro ao criar categoria');
            }
        }
    };
    
    // Cancelar
    cancelBtn.onclick = () => {
        formModal.classList.add('hidden');
        editingCategoryId = null;
    };
    
    // Fechar ao clicar no X ou fora
    formModal.querySelector('.modal-close-btn').onclick = () => {
        formModal.classList.add('hidden');
        editingCategoryId = null;
    };
    
    formModal.onclick = (e) => {
        if (e.target === formModal) {
            formModal.classList.add('hidden');
            editingCategoryId = null;
        }
    };
    
    // Tecla Enter para salvar
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };
}

/** Renderiza a lista de categorias no modal */
async function renderCategoriesList() {
    const listContainer = document.getElementById('categories-list');
    if (!listContainer) return;
    
    // Busca categorias do banco
    let categories = [];
    try {
        categories = await fetchCategories();
    } catch (err) {
        console.error('Erro ao buscar categorias:', err);
    }
    
    if (!categories || categories.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem 0;">Nenhuma categoria cadastrada</p>';
        return;
    }
    
    listContainer.innerHTML = categories.map(cat => `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; gap: 0.5rem;">
                <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-color);">${cat.name}</span>
                    <span style="font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${cat.type === 'GAIN' ? 'var(--secondary-color, #10b981)' : 'var(--danger-color, #ef4444)'}; color: white;">${cat.type === 'GAIN' ? 'Entrada' : 'Saída'}</span>
                </div>
                <div style="display: flex; gap: 0.25rem;">
                    <button type="button" onclick="editCategoryItem('${cat.id}', '${cat.name}', '${cat.type}')" title="Editar" style="padding: 0.4rem 0.6rem; background: none; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; color: var(--text-light); font-size: 0.8rem; transition: all 0.2s;">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button type="button" onclick="deleteCategoryItem('${cat.id}', '${cat.name}')" title="Excluir" style="padding: 0.4rem 0.6rem; background: none; border: 1px solid var(--danger-color, #ef4444); border-radius: 6px; cursor: pointer; color: var(--danger-color, #ef4444); font-size: 0.8rem; transition: all 0.2s;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            ${cat.subcategories && cat.subcategories.length > 0 ? `
                <div style="padding: 0 0.5rem 0.5rem 1.5rem;">
                    <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem; font-weight: 500;">Subcategorias (${cat.subcategories.length}):</div>
                    ${cat.subcategories.map(sub => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; gap: 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">• ${sub.name}</span>
                            <div style="display: flex; gap: 0.25rem;">
                                <button type="button" onclick="editSubcategoryItem('${sub.id}', '${sub.name}', '${cat.id}', '${cat.name}')" title="Editar subcategoria" style="padding: 0.2rem 0.4rem; background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-light); font-size: 0.7rem; transition: all 0.2s;">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button type="button" onclick="deleteSubcategoryItem('${sub.id}', '${sub.name}')" title="Excluir subcategoria" style="padding: 0.2rem 0.4rem; background: none; border: 1px solid var(--danger-color, #ef4444); border-radius: 4px; cursor: pointer; color: var(--danger-color, #ef4444); font-size: 0.7rem; transition: all 0.2s;">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Funções globais para os botões
window.editCategoryItem = (id, name, type = 'EXPENSE') => {
    openCategoryFormModal(id, name, type);
};

window.deleteCategoryItem = async (id, name) => {
    if (!confirm(`Deseja excluir a categoria "${name}"?\n\nTodas as subcategorias serão excluídas também.`)) return;
    
    try {
        await deleteCategory(id);
        await renderCategoriesList();
        await populateExpenseCategorySelect('', true);
        await populateGainCategorySelect('', true);
    } catch (err) {
        alert('Erro ao excluir categoria: ' + err.message);
    }
};

// Funções globais para subcategorias
window.editSubcategoryItem = (id, name, categoryId, categoryName) => {
    openSubcategoryFormModal(categoryId, categoryName, id, name);
};

window.deleteSubcategoryItem = async (id, name) => {
    if (!confirm(`Deseja excluir a subcategoria "${name}"?`)) return;
    
    try {
        await deleteSubcategory(id);
        await renderCategoriesList();
        await populateExpenseSubcategorySelect('', true);
    } catch (err) {
        alert('Erro ao excluir subcategoria: ' + err.message);
    }
};

// Tornar openCategoryFormModal global também (ganhos chama via window para evitar ciclo de import)
window.openCategoryFormModal = openCategoryFormModal;
window.openManageCategoriesModal = openManageCategoriesModal;

// ==================== GERENCIAMENTO DE SUBCATEGORIAS ====================

let editingSubcategoryId = null;

/** Abre o modal de formulário de subcategoria (adicionar ou editar) */
function openSubcategoryFormModal(categoryId = null, categoryName = '', subcategoryId = null, subcategoryName = '') {
    console.log('openSubcategoryFormModal chamado com:', { categoryId, categoryName, subcategoryId, subcategoryName });
    const formModal = document.getElementById('subcategory-form-modal');
    const title = document.getElementById('subcategory-form-title');
    const categoryInput = document.getElementById('subcategory-category-input');
    const nameInput = document.getElementById('subcategory-name-input');
    const saveBtn = document.getElementById('subcategory-save-btn');
    const cancelBtn = document.getElementById('subcategory-cancel-btn');
    
    console.log('Elementos subcategoria encontrados:', { formModal, title, categoryInput, nameInput, saveBtn, cancelBtn });
    
    if (!formModal) {
        console.error('Modal de subcategoria não encontrado!');
        return;
    }
    
    editingSubcategoryId = subcategoryId;
    title.textContent = subcategoryId ? 'Editar Subcategoria' : 'Nova Subcategoria';
    categoryInput.value = categoryName || '';
    nameInput.value = subcategoryName || '';
    formModal.classList.remove('hidden');
    
    console.log('Modal de subcategoria deve estar visível');
    
    // Foco no input
    setTimeout(() => nameInput?.focus(), 100);
    
    // Salvar
    saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Digite um nome para a subcategoria');
            return;
        }
        
        if (editingSubcategoryId) {
            try {
                await updateSubcategory(editingSubcategoryId, name);
                formModal.classList.add('hidden');
                await renderCategoriesList();
                await populateExpenseSubcategorySelect(name, true);
            } catch (err) {
                alert(err?.message || 'Erro ao atualizar subcategoria');
            }
        } else {
            const result = await createSubcategory(categoryId, name);
            if (result.id) {
                formModal.classList.add('hidden');
                await renderCategoriesList();
                await populateExpenseSubcategorySelect(name, true);
            } else if (result.error?.includes('já existe')) {
                alert('Esta subcategoria já existe');
            } else {
                alert(result.error || 'Erro ao criar subcategoria');
            }
        }
    };
    
    // Cancelar
    cancelBtn.onclick = () => {
        formModal.classList.add('hidden');
        editingSubcategoryId = null;
    };
    
    // Fechar ao clicar no X ou fora
    formModal.querySelector('.modal-close-btn').onclick = () => {
        formModal.classList.add('hidden');
        editingSubcategoryId = null;
    };
    
    formModal.onclick = (e) => {
        if (e.target === formModal) {
            formModal.classList.add('hidden');
            editingSubcategoryId = null;
        }
    };
    
    // Tecla Enter para salvar
    nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };
}

// Tornar openSubcategoryFormModal global também
window.openSubcategoryFormModal = openSubcategoryFormModal;

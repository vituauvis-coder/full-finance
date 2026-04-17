// js/features/finance/gain-categories.js
// Categorias de ganho com suporte a subcategorias (mesmo padrão de expense-categories.js)

import { fetchCategories } from '../../services/category-service.js';

/** Cache de categorias carregadas do banco */
let categoriesCache = null;
let categoriesCacheTime = null;
const CACHE_TTL = 60 * 1000; // 1 minuto

const ADD_NEW_VALUE = '__add_new__';

/** Placeholders por categoria */
export const GAIN_DESCRIPTION_PLACEHOLDERS = {
    'Salário': 'Ex.: salário CLT empresa X, 13º, adiantamento quinzenal…',
    'Freelance': 'Ex.: projeto para cliente Y, NF serviço, honorários advocacia…',
    'Investimentos': 'Ex.: dividendos PETR4, juros Tesouro Selic, resgate CDB…',
    'Vendas': 'Ex.: venda usado OLX, marketplace, bico…',
    'Bônus e gratificações': 'Ex.: PLR, gratificação trimestral, comissão vendas…',
    'Presentes recebidos': 'Ex.: presente aniversário, transferência família…',
    'Reembolsos': 'Ex.: reembolso viagem corporativa, plano de saúde…',
    'Aluguel recebido': 'Ex.: aluguel apto centro, temporada Airbnb…',
    'Outros': 'Ex.: descreva a entrada (origem, referência, período…)'
};

const PLACEHOLDER_NO_CATEGORY =
    'Escolha uma categoria acima; o exemplo de descrição muda conforme o tipo de entrada.';

const PLACEHOLDER_CUSTOM_CATEGORY =
    'Ex.: descreva a entrada nesta categoria (origem, valor, quando…).';

/** Busca categorias do banco de dados */
async function loadCategoriesFromDatabase(force = false) {
    const now = Date.now();
    if (!force && categoriesCache && categoriesCacheTime && (now - categoriesCacheTime) < CACHE_TTL) {
        return categoriesCache;
    }

    try {
        categoriesCache = await fetchCategories();
        categoriesCacheTime = now;
        return categoriesCache;
    } catch (err) {
        console.error('Erro ao carregar categorias:', err);
        return [];
    }
}

/** Retorna placeholder apropriado */
export function getGainDescriptionPlaceholder(categoryLabel) {
    const key = categoryLabel != null ? String(categoryLabel).trim() : '';
    if (!key) return PLACEHOLDER_NO_CATEGORY;
    if (GAIN_DESCRIPTION_PLACEHOLDERS[key]) return GAIN_DESCRIPTION_PLACEHOLDERS[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(GAIN_DESCRIPTION_PLACEHOLDERS)) {
        if (k.toLowerCase() === lower) return v;
    }
    return PLACEHOLDER_CUSTOM_CATEGORY;
}

/** Atualiza placeholder do campo de descrição */
export function syncGainDescriptionPlaceholder() {
    const sel = document.getElementById('gain-category-select');
    const input = document.getElementById('gain-description');
    if (!input) return;
    const cat = sel?.value?.trim() || '';
    input.placeholder = getGainDescriptionPlaceholder(cat);
}

/** Retorna subcategorias para uma categoria */
export async function getSubcategoriesForCategory(category) {
    // Ganho não tem subcategorias
    return [];
}

/** Preenche select de categorias */
export async function populateGainCategorySelect(selectedValue = '', forceRefresh = false) {
    const sel = document.getElementById('gain-category-select');
    if (!sel) return;
    
    let categories = [];
    try {
        categories = await loadCategoriesFromDatabase(forceRefresh);
    } catch (err) {
        console.error('Erro ao buscar categorias:', err);
    }
    
    // Filtra apenas categorias do tipo GAIN
    const gainCategories = categories
        ?.filter(c => c.type === 'GAIN')
        ?.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) || [];
    
    sel.innerHTML = '';
    
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Selecione uma categoria';
    sel.appendChild(ph);

    gainCategories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
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
            sel.insertBefore(opt, spacerOpt);
        }
        sel.value = selectedValue;
    }
    syncGainDescriptionPlaceholder();
}

/** Preenche select de subcategorias */
export async function populateGainSubcategorySelect(selectedValue = '') {
    // Ganho não tem subcategorias - função vazia para compatibilidade
    return;
}

/** Adiciona nova subcategoria */
export async function addCustomGainSubcategory(category, subcategoryName) {
    // Ganho não tem subcategorias
    return { ok: false, reason: 'not_supported' };
}

let gainCategoryUiBound = false;

/** Inicializa UI de categorias de ganho */
export function setupGainCategoryUi() {
    if (gainCategoryUiBound) return;
    gainCategoryUiBound = true;

    const sel = document.getElementById('gain-category-select');
    
    if (!sel) return;

    sel.addEventListener('change', async () => {
        if (sel.value === ADD_NEW_VALUE) {
            sel.value = '';
            syncGainDescriptionPlaceholder();
            // Abre modal para adicionar nova categoria (tipo Entrada)
            window.openCategoryFormModal(null, '', 'GAIN');
        } else if (sel.value === '__manage_categories__') {
            sel.value = '';
            syncGainDescriptionPlaceholder();
            // Abre modal de gerenciamento
            window.openManageCategoriesModal();
        } else {
            syncGainDescriptionPlaceholder();
        }
        // Ganho não tem subcategorias
    });
}

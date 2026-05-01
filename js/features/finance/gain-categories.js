// js/features/finance/gain-categories.js
// Categorias de ganho com subcategorias (mesmo padrão que expense-categories.js)

import { fetchCategories, createSubcategory } from '../../services/category-service.js';

/** Cache de categorias carregadas do banco */
let categoriesCache = null;
let categoriesCacheTime = null;
const CACHE_TTL = 60 * 1000; // 1 minuto

const ADD_NEW_VALUE = '__add_new__';

export function invalidateGainCategoriesCache() {
    categoriesCache = null;
    categoriesCacheTime = null;
}

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
    Outros: 'Ex.: descreva a entrada (origem, referência, período…)'
};

const PLACEHOLDER_NO_CATEGORY =
    'Escolha uma categoria acima; o exemplo de descrição muda conforme o tipo de entrada.';

const PLACEHOLDER_CUSTOM_CATEGORY =
    'Ex.: descreva a entrada nesta categoria (origem, valor, quando…).';

async function loadCategoriesFromDatabase(force = false) {
    const now = Date.now();
    if (!force && categoriesCache && categoriesCacheTime && now - categoriesCacheTime < CACHE_TTL) {
        return categoriesCache;
    }

    try {
        categoriesCache = await fetchCategories();
        categoriesCacheTime = now;
        return categoriesCache;
    } catch (err) {
        console.error('Erro ao carregar categorias (ganho):', err);
        return [];
    }
}

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

export function syncGainDescriptionPlaceholder() {
    const sel = document.getElementById('gain-category-select');
    const input = document.getElementById('gain-description');
    if (!input) return;
    const cat = sel?.value?.trim() || '';
    input.placeholder = getGainDescriptionPlaceholder(cat);
}

/**
 * Subcategorias da categoria de entrada (tipo GAIN no banco).
 */
export async function getGainSubcategoriesForCategory(category) {
    const cat = String(category).trim();
    if (!cat) return [];

    await loadCategoriesFromDatabase(false);
    const categoryObj = categoriesCache?.find((c) => c.name === cat && c.type === 'GAIN');
    if (!categoryObj?.subcategories) return [];

    return categoryObj.subcategories
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function populateGainCategorySelect(selectedValue = '', forceRefresh = false) {
    const sel = document.getElementById('gain-category-select');
    if (!sel) return;

    let categories = [];
    try {
        categories = await loadCategoriesFromDatabase(forceRefresh);
    } catch (err) {
        console.error('Erro ao buscar categorias:', err);
    }

    const gainCategories =
        categories?.filter((c) => c.type === 'GAIN')?.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) || [];

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

    const spacerOpt = document.createElement('option');
    spacerOpt.value = '';
    spacerOpt.textContent = '─────────────────';
    spacerOpt.disabled = true;
    spacerOpt.style.color = '#e5e7eb';
    spacerOpt.style.fontSize = '0.8rem';
    sel.appendChild(spacerOpt);

    const manageOpt = document.createElement('option');
    manageOpt.value = '__manage_categories__';
    manageOpt.textContent = '⚙️ Gerenciar categorias...';
    sel.appendChild(manageOpt);

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
    await populateGainSubcategorySelect('', forceRefresh);
}

export async function populateGainSubcategorySelect(selectedValue = '', forceRefresh = false) {
    const catSel = document.getElementById('gain-category-select');
    const subSel = document.getElementById('gain-subcategory-select');
    if (!subSel) return;

    await loadCategoriesFromDatabase(forceRefresh);

    const selectedCategory = catSel?.value || '';
    const subcats = selectedCategory ? await getGainSubcategoriesForCategory(selectedCategory) : [];

    subSel.innerHTML = '';

    subSel.disabled = !selectedCategory;

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
        const spacerOpt = document.createElement('option');
        spacerOpt.value = '';
        spacerOpt.textContent = '─────────────────';
        spacerOpt.disabled = true;
        spacerOpt.style.color = '#e5e7eb';
        spacerOpt.style.fontSize = '0.8rem';
        subSel.appendChild(spacerOpt);

        const manageOpt = document.createElement('option');
        manageOpt.value = '__manage_subcategories__';
        manageOpt.textContent = '⚙️ Gerenciar subcategorias...';
        subSel.appendChild(manageOpt);

        const addOpt = document.createElement('option');
        addOpt.value = ADD_NEW_VALUE;
        addOpt.textContent = '➕ Adicionar nova subcategoria...';
        subSel.appendChild(addOpt);
    }

    if (selectedValue && subcats.includes(selectedValue)) {
        subSel.value = selectedValue;
    } else if (selectedValue && selectedCategory) {
        const opt = document.createElement('option');
        opt.value = selectedValue;
        opt.textContent = selectedValue;
        subSel.insertBefore(opt, subSel.options[1] || null);
        subSel.value = selectedValue;
    }
}

export async function addCustomGainSubcategory(category, subcategoryName) {
    const cat = String(category).trim();
    const sub = String(subcategoryName).trim();
    if (!cat || !sub) return { ok: false, reason: 'empty' };

    await loadCategoriesFromDatabase(false);
    const categoryObj = categoriesCache?.find((c) => c.name === cat && c.type === 'GAIN');
    if (!categoryObj) return { ok: false, reason: 'category_not_found' };

    try {
        const result = await createSubcategory(categoryObj.id, sub);
        invalidateGainCategoriesCache();
        await loadCategoriesFromDatabase(true);
        return { ok: true, duplicate: false, subcategory: result };
    } catch (err) {
        if (String(err.message || '').includes('já existe')) {
            return { ok: true, duplicate: true };
        }
        return { ok: false, reason: err.message };
    }
}

let gainCategoryUiBound = false;

export function setupGainCategoryUi() {
    if (gainCategoryUiBound) return;
    gainCategoryUiBound = true;

    const sel = document.getElementById('gain-category-select');
    const subSel = document.getElementById('gain-subcategory-select');
    const subNewRow = document.getElementById('gain-subcategory-new-row');
    const subNewInput = document.getElementById('gain-subcategory-new-input');
    const subSaveBtn = document.getElementById('gain-subcategory-new-save');
    const subCancelBtn = document.getElementById('gain-subcategory-new-cancel');

    if (!sel) return;

    sel.addEventListener('change', async () => {
        if (sel.value === ADD_NEW_VALUE) {
            sel.value = '';
            syncGainDescriptionPlaceholder();
            window.openCategoryFormModal(null, '', 'GAIN');
        } else if (sel.value === '__manage_categories__') {
            sel.value = '';
            syncGainDescriptionPlaceholder();
            window.openManageCategoriesModal();
        } else {
            syncGainDescriptionPlaceholder();
        }
        await populateGainSubcategorySelect();
    });

    if (subSel) {
        subSel.addEventListener('change', async () => {
            if (subSel.value === ADD_NEW_VALUE) {
                await loadCategoriesFromDatabase(false);
                const selectedCategory = sel?.value?.trim();
                const categoryObj = categoriesCache?.find((c) => c.name === selectedCategory && c.type === 'GAIN');
                if (!selectedCategory || !categoryObj) {
                    alert('Selecione uma categoria primeiro');
                    subSel.value = '';
                    return;
                }
                subSel.value = '';
                window.openSubcategoryFormModal(categoryObj.id, selectedCategory);
            } else if (subSel.value === '__manage_subcategories__') {
                subSel.value = '';
                window.openManageCategoriesModal();
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
            const result = await addCustomGainSubcategory(category, name);
            if (result.ok) {
                await populateGainSubcategorySelect(name, true);
                hideSubNewRow();
            }
        }

        subCancelBtn?.addEventListener('click', hideSubNewRow);
        subSaveBtn?.addEventListener('click', () => void saveNewSubcategory());
        subNewInput?.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveNewSubcategory();
            }
        });
    }
}

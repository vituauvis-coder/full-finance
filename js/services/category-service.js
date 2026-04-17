/**
 * Serviço para gerenciamento de categorias e subcategorias via API
 * Substitui o armazenamento localStorage pelo banco de dados
 *
 * Em `npm run dev`, usar base vazia (URLs relativas /api/...) para o proxy do Vite
 * encaminhar à API — igual a api-client.js. Se VITE_API_URL apontar a localhost e
 * outro PC acessar pelo IP da rede, fetch iria para o localhost daquele PC (falha).
 */
const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || '';

/**
 * Busca todas as categorias do usuário logado
 * @returns {Promise<Array>} Lista de categorias com subcategorias
 */
export async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/categories`, {
            credentials: 'include'
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erro na resposta:', res.status, errorData);
            throw new Error(errorData.error || 'Erro ao buscar categorias');
        }
        const data = await res.json();
        console.log('Categorias recebidas:', data);
        return data;
    } catch (err) {
        console.error('Erro completo ao buscar categorias:', err);
        throw err;
    }
}

/**
 * Cria uma nova categoria
 * @param {string} name - Nome da categoria
 * @param {string} type - Tipo da categoria (GAIN ou EXPENSE)
 * @returns {Promise<Object>} Categoria criada
 */
export async function createCategory(name, type = 'EXPENSE') {
    const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, type })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar categoria');
    }
    return res.json();
}

/**
 * Atualiza uma categoria existente
 * @param {string} id - ID da categoria
 * @param {string} name - Novo nome
 * @param {string} type - Tipo da categoria (GAIN ou EXPENSE)
 * @returns {Promise<Object>} Categoria atualizada
 */
export async function updateCategory(id, name, type = 'EXPENSE') {
    const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, type })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar categoria');
    }
    return res.json();
}

/**
 * Exclui uma categoria e suas subcategorias
 * @param {string} id - ID da categoria
 * @returns {Promise<Object>} Resultado da operação
 */
export async function deleteCategory(id) {
    const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao excluir categoria');
    }
    return res.json();
}

/**
 * Busca subcategorias de uma categoria
 * @param {string} categoryId - ID da categoria
 * @returns {Promise<Array>} Lista de subcategorias
 */
export async function fetchSubcategories(categoryId) {
    const res = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/subcategories`, {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao buscar subcategorias');
    return res.json();
}

/**
 * Cria uma nova subcategoria
 * @param {string} categoryId - ID da categoria pai
 * @param {string} name - Nome da subcategoria
 * @returns {Promise<Object>} Subcategoria criada
 */
export async function createSubcategory(categoryId, name) {
    const res = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar subcategoria');
    }
    return res.json();
}

/**
 * Atualiza uma subcategoria existente
 * @param {string} id - ID da subcategoria
 * @param {string} name - Novo nome
 * @returns {Promise<Object>} Subcategoria atualizada
 */
export async function updateSubcategory(id, name) {
    const res = await fetch(`${API_BASE_URL}/api/subcategories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar subcategoria');
    }
    return res.json();
}

/**
 * Exclui uma subcategoria
 * @param {string} id - ID da subcategoria
 * @returns {Promise<Object>} Resultado da operação
 */
export async function deleteSubcategory(id) {
    const res = await fetch(`${API_BASE_URL}/api/subcategories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao excluir subcategoria');
    }
    return res.json();
}

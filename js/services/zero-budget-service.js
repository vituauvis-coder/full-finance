/**
 * Serviço para gerenciamento de blocos de orçamento do Planejamento Base Zero
 * Comunica com a API REST para persistir dados no SQL Server
 */

const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || '';

/**
 * Busca todos os blocos de orçamento do usuário para um mes/ano especifico
 * @param {number} month - Mes (1-12)
 * @param {number} year - Ano
 * @returns {Promise<Array>} Lista de blocos com categorias vinculadas
 */
export async function fetchZeroBudgetBlocks(month, year) {
    try {
        const res = await fetch(
            `${API_BASE_URL}/api/zero-budget?month=${month}&year=${year}`,
            { credentials: 'include' }
        );
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erro ao buscar blocos:', res.status, errorData);
            throw new Error(errorData.error || 'Erro ao buscar blocos de orçamento');
        }
        const data = await res.json();
        return data.blocks || [];
    } catch (err) {
        console.error('Erro completo ao buscar blocos:', err);
        throw err;
    }
}

/**
 * Cria um novo bloco de orçamento (uma categoria; o nome do bloco = categoria)
 * @param {Object} data - Dados do bloco
 * @param {string} data.categoryName - Categoria de saída
 * @param {string} data.color - Cor do bloco (classe CSS)
 * @param {number} data.allocatedAmount - Valor alocado
 * @param {number} data.month - Mes (1-12)
 * @param {number} data.year - Ano
 * @returns {Promise<Object>} Bloco criado
 */
export async function createZeroBudgetBlock(data) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/zero-budget/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erro ao criar bloco:', res.status, errorData);
            throw new Error(errorData.error || 'Erro ao criar bloco');
        }
        return res.json();
    } catch (err) {
        console.error('Erro completo ao criar bloco:', err);
        throw err;
    }
}

/**
 * Atualiza um bloco de orçamento existente
 * @param {string} id - ID do bloco
 * @param {Object} data - Dados a atualizar
 * @returns {Promise<Object>} Bloco atualizado
 */
export async function updateZeroBudgetBlock(id, data) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/zero-budget/blocks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erro ao atualizar bloco:', res.status, errorData);
            throw new Error(errorData.error || 'Erro ao atualizar bloco');
        }
        return res.json();
    } catch (err) {
        console.error('Erro completo ao atualizar bloco:', err);
        throw err;
    }
}

/**
 * Remove um bloco de orçamento
 * @param {string} id - ID do bloco
 * @returns {Promise<Object>} Resultado da operação
 */
export async function deleteZeroBudgetBlock(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/zero-budget/blocks/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erro ao excluir bloco:', res.status, errorData);
            throw new Error(errorData.error || 'Erro ao excluir bloco');
        }
        return res.json();
    } catch (err) {
        console.error('Erro completo ao excluir bloco:', err);
        throw err;
    }
}

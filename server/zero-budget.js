/**
 * Controller para Planejamento Base Zero (Zero-Based Budgeting)
 * Um bloco = uma categoria de saída; `name` espelha `category_name`.
 * Versão PostgreSQL (Supabase)
 */

import { query } from './db.js';

/**
 * @param {string} s
 */
function trimCat(s) {
    return String(s || '').trim();
}

/**
 * Busca todos os blocos do usuário para um mês/ano (com categoryName + categories legível)
 */
export async function fetchZeroBudgetBlocks(userId, month, year) {
    const blocksResult = await query(
        `SELECT id,
                name,
                category_name as "categoryName",
                color,
                allocated_amount as "allocatedAmount",
                month,
                year,
                created_at as "createdAt",
                updated_at as "updatedAt"
         FROM zero_budget_blocks
         WHERE user_id = $1 AND month = $2 AND year = $3
         ORDER BY created_at ASC`,
        [userId, month, year]
    );

    const rows = blocksResult?.rows || [];
    return rows.map((block) => {
        const cat = trimCat(block.categoryName) || trimCat(block.name);
        return {
            ...block,
            categoryName: cat,
            categories: cat ? [cat] : []
        };
    });
}

/**
 * Cria bloco: obrigatório categoryName; name = categoryName
 */
export async function createZeroBudgetBlock(userId, data) {
    const categoryName = trimCat(data.categoryName);
    const color = data.color || 'bg-amber-500';
    const allocatedAmount = Number(data.allocatedAmount) || 0;
    const month = Number(data.month);
    const year = Number(data.year);

    if (!categoryName || !month || !year) {
        throw new Error('Categoria, mês e ano são obrigatórios');
    }

    const dup = await query(
        `SELECT id FROM zero_budget_blocks
         WHERE user_id = $1 AND month = $2 AND year = $3 AND category_name = $4`,
        [userId, month, year, categoryName]
    );
    if ((dup?.rows || []).length > 0) {
        throw new Error('Já existe um bloco para esta categoria neste mês');
    }

    const result = await query(
        `INSERT INTO zero_budget_blocks (user_id, name, category_name, color, allocated_amount, month, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id as "userId", name, category_name as "categoryName", color,
                   allocated_amount as "allocatedAmount", month, year,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [userId, categoryName, categoryName, color, allocatedAmount, month, year]
    );

    const block = result.rows?.[0];
    if (!block) {
        throw new Error('Falha ao criar bloco');
    }
    const cat = trimCat(block.categoryName) || trimCat(block.name);
    return {
        ...block,
        categoryName: cat,
        categories: cat ? [cat] : []
    };
}

/**
 * Atualiza cor e/ou valor alocado (nome/categoria não mudam por aqui)
 */
export async function updateZeroBudgetBlock(userId, blockId, data) {
    const { color, allocatedAmount } = data;

    const existingRes = await query(
        `SELECT id, month, year FROM zero_budget_blocks WHERE id = $1 AND user_id = $2`,
        [blockId, userId]
    );
    const existing = existingRes?.rows || [];

    if (existing.length === 0) {
        throw new Error('Bloco não encontrado ou não pertence ao usuário');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (color !== undefined) {
        updates.push(`color = $${paramIndex++}`);
        params.push(color);
    }
    if (allocatedAmount !== undefined) {
        updates.push(`allocated_amount = $${paramIndex++}`);
        params.push(allocatedAmount);
    }

    if (updates.length === 0) {
        throw new Error('Nenhum campo para atualizar');
    }

    updates.push(`updated_at = NOW()`);
    params.push(blockId);
    params.push(userId);

    await query(
        `UPDATE zero_budget_blocks SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
        params
    );

    const blocks = await fetchZeroBudgetBlocks(userId, existing[0].month, existing[0].year);
    return blocks.find((b) => b.id === blockId);
}

/**
 * Remove um bloco
 */
export async function deleteZeroBudgetBlock(userId, blockId) {
    const existingRes = await query(
        `SELECT id FROM zero_budget_blocks WHERE id = $1 AND user_id = $2`,
        [blockId, userId]
    );
    const existing = existingRes?.rows || [];

    if (existing.length === 0) {
        throw new Error('Bloco não encontrado ou não pertence ao usuário');
    }

    await query(`DELETE FROM zero_budget_blocks WHERE id = $1 AND user_id = $2`, [blockId, userId]);

    return { success: true };
}

/**
 * Configura as rotas da API para Zero Budget
 */
export function registerZeroBudgetRoutes(app, requireAuth) {
    app.get('/api/zero-budget', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const month = parseInt(req.query.month, 10);
            const year = parseInt(req.query.year, 10);

            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                return res.status(400).json({ error: 'Mes e ano invalidos' });
            }

            const blocks = await fetchZeroBudgetBlocks(userId, month, year);
            res.json({ blocks });
        } catch (error) {
            console.error('Erro ao buscar blocos de orçamento:', error);
            res.status(500).json({ error: 'Erro ao buscar blocos de orçamento' });
        }
    });

    app.post('/api/zero-budget/blocks', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const block = await createZeroBudgetBlock(userId, req.body);
            res.status(201).json(block);
        } catch (error) {
            console.error('Erro ao criar bloco de orçamento:', error);
            res.status(400).json({ error: error.message || 'Erro ao criar bloco' });
        }
    });

    app.put('/api/zero-budget/blocks/:id', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const blockId = req.params.id;
            const block = await updateZeroBudgetBlock(userId, blockId, req.body);
            res.json(block);
        } catch (error) {
            console.error('Erro ao atualizar bloco:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 400).json({ error: error.message });
        }
    });

    app.delete('/api/zero-budget/blocks/:id', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const blockId = req.params.id;
            await deleteZeroBudgetBlock(userId, blockId);
            res.json({ success: true });
        } catch (error) {
            console.error('Erro ao remover bloco:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 500).json({ error: error.message });
        }
    });
}

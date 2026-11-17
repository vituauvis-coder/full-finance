/**
 * Controller para Planejamento Base Zero (Zero-Based Budgeting)
 * Um bloco = uma categoria de saída; `name` espelha `category_name`.
 * Versão PostgreSQL (Supabase)
 */

import { randomUUID } from 'node:crypto';
import { query } from './db.js';

/**
 * @param {string} s
 */
function trimCat(s) {
    return String(s || '').trim();
}

/**
 * @param {string} s
 */
function trimTitle(s) {
    const t = String(s || '').trim();
    return t.length > 500 ? t.slice(0, 500) : t;
}

function todoAmount(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x < 0) return 0;
    return Math.round(x * 100) / 100;
}

/**
 * @param {string} userId
 * @param {string} blockId
 */
async function assertBlockOwned(userId, blockId) {
    const r = await query(
        `SELECT id FROM zero_budget_blocks WHERE id = $1 AND user_id = $2`,
        [blockId, userId]
    );
    if (!(r?.rows || []).length) {
        throw new Error('Bloco não encontrado ou não pertence ao usuário');
    }
}

/**
 * @param {string} userId
 * @param {string} todoId
 * @returns {Promise<{ id: string, blockId: string } | null>}
 */
async function findTodoForUser(userId, todoId) {
    const r = await query(
        `SELECT t.id, t.block_id as "blockId"
         FROM zero_budget_block_todos t
         INNER JOIN zero_budget_blocks b ON b.id = t.block_id
         WHERE t.id = $1 AND b.user_id = $2`,
        [todoId, userId]
    );
    return r?.rows?.[0] || null;
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
 * Lista to-dos de um bloco (ordem estável)
 * @param {string} userId
 * @param {string} blockId
 */
export async function fetchZeroBudgetBlockTodos(userId, blockId) {
    await assertBlockOwned(userId, blockId);
    const r = await query(
        `SELECT t.id,
                t.block_id as "blockId",
                t.title,
                t.amount,
                t.is_purchased as "isPurchased",
                t.sort_order as "sortOrder",
                t.created_at as "createdAt"
         FROM zero_budget_block_todos t
         INNER JOIN zero_budget_blocks b ON b.id = t.block_id
         WHERE t.block_id = $1 AND b.user_id = $2
         ORDER BY t.sort_order ASC, t.created_at ASC`,
        [blockId, userId]
    );
    return r?.rows || [];
}

/**
 * @param {string} userId
 * @param {string} blockId
 * @param {{ title?: string, amount?: number }} data
 */
export async function createZeroBudgetBlockTodo(userId, blockId, data) {
    await assertBlockOwned(userId, blockId);
    const title = trimTitle(data?.title);
    if (!title) {
        throw new Error('Título é obrigatório');
    }
    const amount = todoAmount(data?.amount);
    const id = randomUUID();
    const maxRes = await query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 as n
         FROM zero_budget_block_todos WHERE block_id = $1`,
        [blockId]
    );
    const sortOrder = Number(maxRes?.rows?.[0]?.n) || 0;
    const ins = await query(
        `INSERT INTO zero_budget_block_todos (id, block_id, title, amount, is_purchased, sort_order)
         VALUES ($1, $2, $3, $4, FALSE, $5)
         RETURNING id, block_id as "blockId", title, amount, is_purchased as "isPurchased",
                   sort_order as "sortOrder", created_at as "createdAt"`,
        [id, blockId, title, amount, sortOrder]
    );
    const row = ins?.rows?.[0];
    if (!row) throw new Error('Falha ao criar item');
    return row;
}

/**
 * @param {string} userId
 * @param {string} todoId
 * @param {{ title?: string, amount?: number, isPurchased?: boolean }} data
 */
export async function updateZeroBudgetBlockTodo(userId, todoId, data) {
    const found = await findTodoForUser(userId, todoId);
    if (!found) {
        throw new Error('Item não encontrado ou não pertence ao usuário');
    }
    const updates = [];
    const params = [];
    let i = 1;
    if (data.title !== undefined) {
        const title = trimTitle(data.title);
        if (!title) throw new Error('Título não pode ficar vazio');
        updates.push(`title = $${i++}`);
        params.push(title);
    }
    if (data.isPurchased !== undefined) {
        updates.push(`is_purchased = $${i++}`);
        params.push(Boolean(data.isPurchased));
    }
    if (data.amount !== undefined) {
        updates.push(`amount = $${i++}`);
        params.push(todoAmount(data.amount));
    }
    if (updates.length === 0) {
        throw new Error('Nenhum campo para atualizar');
    }
    params.push(todoId);
    await query(
        `UPDATE zero_budget_block_todos SET ${updates.join(', ')} WHERE id = $${i}`,
        params
    );
    const r = await query(
        `SELECT t.id, t.block_id as "blockId", t.title, t.amount, t.is_purchased as "isPurchased",
                t.sort_order as "sortOrder", t.created_at as "createdAt"
         FROM zero_budget_block_todos t
         WHERE t.id = $1`,
        [todoId]
    );
    return r?.rows?.[0];
}

/**
 * @param {string} userId
 * @param {string} todoId
 */
export async function deleteZeroBudgetBlockTodo(userId, todoId) {
    const found = await findTodoForUser(userId, todoId);
    if (!found) {
        throw new Error('Item não encontrado ou não pertence ao usuário');
    }
    await query(`DELETE FROM zero_budget_block_todos WHERE id = $1`, [todoId]);
    return { success: true };
}

/** Remove um bloco (cascade remove to-dos no Postgres). */
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

    app.get('/api/zero-budget/blocks/:blockId/todos', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const { blockId } = req.params;
            const todos = await fetchZeroBudgetBlockTodos(userId, blockId);
            res.json({ todos });
        } catch (error) {
            console.error('Erro ao listar to-dos do bloco:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 500).json({
                error: error.message || 'Erro ao listar itens'
            });
        }
    });

    app.post('/api/zero-budget/blocks/:blockId/todos', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const { blockId } = req.params;
            const todo = await createZeroBudgetBlockTodo(userId, blockId, req.body);
            res.status(201).json(todo);
        } catch (error) {
            console.error('Erro ao criar to-do do bloco:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 400).json({
                error: error.message || 'Erro ao criar item'
            });
        }
    });

    app.patch('/api/zero-budget/todos/:todoId', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const { todoId } = req.params;
            const todo = await updateZeroBudgetBlockTodo(userId, todoId, req.body);
            res.json(todo);
        } catch (error) {
            console.error('Erro ao atualizar to-do:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 400).json({
                error: error.message || 'Erro ao atualizar item'
            });
        }
    });

    app.delete('/api/zero-budget/todos/:todoId', requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const { todoId } = req.params;
            await deleteZeroBudgetBlockTodo(userId, todoId);
            res.json({ success: true });
        } catch (error) {
            console.error('Erro ao remover to-do:', error);
            res.status(error.message.includes('não encontrado') ? 404 : 500).json({
                error: error.message || 'Erro ao remover item'
            });
        }
    });
}

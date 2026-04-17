/**
 * Insere 20 despesas de exemplo (variadas) para testar a UI.
 * Uso: node scripts/seed-expenses.mjs
 * Opcional: SEED_USER_EMAIL=email@exemplo.com node scripts/seed-expenses.mjs
 */
import crypto from 'node:crypto';
import { query, pool, withTransaction } from '../server/db.js';

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12 + (n % 7), (n * 13) % 60, 0, 0);
    return d;
}

const SAMPLES = [
    { category: 'Alimentação', amount: 187.42, description: 'Compras no supermercado', days: 5, isPaid: true },
    { category: 'Transporte', amount: 23.9, description: 'Uber — ida ao trabalho', days: 2, isPaid: true },
    { category: 'Assinaturas', amount: 39.9, description: 'Streaming mensal', days: 28, isPaid: true },
    { category: 'Saúde', amount: 67.2, description: 'Farmácia — medicamentos', days: 10, isPaid: true },
    { category: 'Alimentação', amount: 89.0, description: 'Jantar em restaurante', days: 1, isPaid: true },
    { category: 'Energia', amount: 145.0, description: 'Conta de luz', days: 15, isPaid: true },
    { category: 'Saúde', amount: 99.9, description: 'Mensalidade academia', days: 20, isPaid: true },
    { category: 'Transporte', amount: 200.0, description: 'Abastecimento', days: 3, isPaid: true },
    { category: 'Lazer', amount: 45.0, description: 'Cinema — dois ingressos', days: 6, isPaid: true },
    { category: 'Transporte', amount: 450.0, description: 'Revisão do veículo', days: 25, isPaid: true },
    { category: 'Moradia', amount: 1200.0, description: 'Aluguel', days: 32, isPaid: true },
    { category: 'Educação', amount: 197.0, description: 'Curso online', days: 18, isPaid: true },
    { category: 'Pet', amount: 120.5, description: 'Pet shop — ração e banho', days: 7, isPaid: true },
    { category: 'Vestuário', amount: 159.99, description: 'Loja de roupas', days: 12, isPaid: false },
    { category: 'Outros', amount: 75.0, description: 'Presente — aniversário', days: 4, isPaid: true },
    { category: 'Alimentação', amount: 42.3, description: 'Pedido de comida', days: 0, isPaid: true },
    { category: 'Assinaturas', amount: 21.9, description: 'Música — plano individual', days: 8, isPaid: true },
    { category: 'Saúde', amount: 280.0, description: 'Consulta odontológica', days: 30, isPaid: true },
    { category: 'Trabalho', amount: 89.9, description: 'Material de escritório', days: 14, isPaid: true },
    { category: 'Transporte', amount: 156.0, description: 'Passagem de ônibus intermunicipal', days: 22, isPaid: true }
];

async function main() {
    const emailFilter = process.env.SEED_USER_EMAIL?.trim().toLowerCase();

    const user = emailFilter
        ? (
              await query(
                  `SELECT id, email, name FROM users WHERE email = $1 ORDER BY created_at ASC LIMIT 1`,
                  [emailFilter]
              )
          ).rows[0]
        : (await query(`SELECT id, email, name FROM users ORDER BY created_at ASC LIMIT 1`)).rows[0];

    if (!user) {
        console.error(
            emailFilter
                ? `Usuário não encontrado: ${emailFilter}`
                : 'Nenhum usuário no banco. Crie uma conta ou defina SEED_USER_EMAIL.'
        );
        process.exit(1);
    }

    const { rows: accounts } = await query(
        `SELECT id, name FROM accounts WHERE user_id = $1 ORDER BY name ASC`,
        [user.id]
    );

    if (accounts.length === 0) {
        console.error('Este usuário não tem contas/cartões. Cadastre pelo menos uma conta antes.');
        process.exit(1);
    }

    const rows = SAMPLES.map((row, i) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: accounts[i % accounts.length].id,
        category: row.category,
        amount: row.amount,
        description: row.description,
        date: daysAgo(row.days),
        isPaid: row.isPaid,
        isInvestment: false
    }));

    await withTransaction(async (client) => {
        for (const r of rows) {
            await client.query(
                `INSERT INTO expenses (
                    id, user_id, account_id, category, subcategory, amount, description,
                    date, created_at, is_paid, is_investment
                 ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7, now(), $8, $9)`,
                [r.id, r.userId, r.accountId, r.category, r.amount, r.description, r.date, r.isPaid, r.isInvestment]
            );
        }
    });

    console.log(`OK: ${rows.length} despesas criadas para ${user.email} (contas usadas: ${accounts.length}).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });

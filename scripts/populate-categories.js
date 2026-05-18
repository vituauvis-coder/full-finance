/**
 * Script para popular categorias e subcategorias padrão no banco de dados.
 * Execute: node scripts/populate-categories.js
 */

import crypto from 'node:crypto';
import { query, pool, withTransaction } from '../server/db.js';

const DEFAULT_CATEGORIES = [
    'Alimentação',
    'Moradia',
    'Transporte',
    'Saúde',
    'Educação',
    'Lazer',
    'Supermercado',
    'Assinaturas',
    'Roupas',
    'Pets',
    'Viagens',
    'Cofrinhos',
    'Trabalho',
    'Seguros',
    'Empréstimo',
    'Outros'
];

const DEFAULT_SUBCATEGORIES = {
    'Alimentação': [
        'Restaurante',
        'Lanche',
        'Café',
        'Delivery',
        'Padaria'
    ],
    'Moradia': [
        'Aluguel',
        'Condomínio',
        'Financiamento',
        'Reparos',
        'Mobília'
    ],
    'Transporte': [
        'Uber/99',
        'Gasolina',
        'Estacionamento',
        'Transporte público',
        'Taxi'
    ],
    'Saúde': [
        'Consulta médica',
        'Remédios',
        'Exames',
        'Dentista',
        'Academia'
    ],
    'Educação': [
        'Curso online',
        'Livros',
        'Material escolar',
        'Mensalidade',
        'Idiomas'
    ],
    'Lazer': [
        'Cinema',
        'Show',
        'Bar',
        'Clube',
        'Games'
    ],
    'Supermercado': [
        'Compras mensais',
        'Hortifruti',
        'Bebidas',
        'Limpeza',
        'Congelados'
    ],
    'Assinaturas': [
        'Streaming',
        'Software',
        'Jornais/Revistas',
        'Música',
        'Jogos'
    ],
    'Roupas': [
        'Roupas',
        'Calçados',
        'Acessórios',
        'Bolsas',
        'Joias'
    ],
    'Pets': [
        'Ração',
        'Veterinário',
        'Remédios',
        'Banho/Tosa',
        'Acessórios'
    ],
    'Viagens': [
        'Passagem aérea',
        'Hotel',
        'Aluguel carro',
        'Passeios',
        'Compras viaje'
    ],
    'Cofrinhos': [
        'Taxa corretora',
        'IOF',
        'Impostos',
        'Multa',
        'Juros'
    ],
    'Trabalho': [
        'Coworking',
        'Material escritório',
        'Transporte trabalho',
        'Lanche trabalho',
        'Outros'
    ],
    'Seguros': [
        'Seguro carro',
        'Seguro residência',
        'Seguro vida',
        'Seguro saúde',
        'Outros'
    ],
    'Outros': [
        'Diversos',
        'Emergência',
        'Não categorizado',
        'Presentes',
        'Doações'
    ]
};

async function populateCategories() {
    try {
        // Para cada usuário existente, adicionar categorias
        const { rows: users } = await query(`SELECT id, name, email FROM users`);
        
        if (users.length === 0) {
            console.log('Nenhum usuário encontrado. Crie um usuário primeiro.');
            return;
        }
        
        console.log(`Encontrados ${users.length} usuários`);
        
        for (const user of users) {
            console.log(`\nProcessando usuário: ${user.name} (${user.email})`);
            
            // Verificar se já tem categorias
            const { rows: existingCategories } = await query(
                `SELECT id FROM categories WHERE user_id = $1 LIMIT 1`,
                [user.id]
            );
            
            if (existingCategories.length > 0) {
                console.log(`Usuário já tem categorias. Pulando.`);
                continue;
            }
            
            // Criar categorias e subcategorias
            await withTransaction(async (client) => {
                for (const categoryName of DEFAULT_CATEGORIES) {
                    console.log(`  Criando categoria: ${categoryName}`);
                    const categoryId = crypto.randomUUID();
                    await client.query(
                        `INSERT INTO categories (id, user_id, name, type, is_default, created_at, updated_at)
                         VALUES ($1,$2,$3,'EXPENSE',true, now(), now())`,
                        [categoryId, user.id, categoryName]
                    );

                    const subcategories = DEFAULT_SUBCATEGORIES[categoryName] || [];
                    for (const subcategoryName of subcategories) {
                        await client.query(
                            `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
                             VALUES ($1,$2,$3,$4,true, now(), now())`,
                            [crypto.randomUUID(), user.id, categoryId, subcategoryName]
                        );
                    }
                    console.log(`    ${subcategories.length} subcategorias criadas`);
                }
            });
            
            console.log(`Usuário ${user.name} finalizado com ${DEFAULT_CATEGORIES.length} categorias`);
        }
        
        console.log('\nPopulação concluída com sucesso!');
    } catch (error) {
        console.error('Erro ao popular categorias:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Executar script
populateCategories()
    .then(() => {
        console.log('\nScript finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nScript falhou:', error);
        process.exit(1);
    });

export { populateCategories, DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES };

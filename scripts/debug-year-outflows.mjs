import 'dotenv/config';
import { query, pool } from '../server/db.js';
import {
  getInstallmentDueDates,
  getLoanInstallmentDueDates,
  isLoanExpense,
} from '../js/core/credit-installments.js';
import { isCreditCardType, movementDateToJsDate } from '../js/core/utils.js';

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function perInstallmentCount(expense) {
  const n = parseInt(String(expense.installmentCount ?? '1'), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Saída do ano até cutoff (inclui parcelas vencidas até cutoff, por vencimento).
 * Não depende de confirmação manual; foca em "já venceu até hoje".
 */
function explodeExpenseIntoYearContributions(expense, account, year, cutoffEndInclusive) {
  const cutoffT = endOfDay(cutoffEndInclusive).getTime();
  const out = [];
  const n = perInstallmentCount(expense);
  const amount = Number(expense.amount) || 0;
  const purchase = movementDateToJsDate(expense.date);
  if (Number.isNaN(purchase.getTime())) return out;

  // Cartão: parcela por vencimento (se tiver dueDay)
  if (account && isCreditCardType(account.type)) {
    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    if (!dueDay) {
      // fallback: pela data do lançamento
      if (purchase.getFullYear() !== year) return out;
      if (purchase.getTime() > cutoffT) return out;
      out.push({
        expenseId: expense.id,
        description: expense.description,
        category: expense.category,
        subcategory: expense.subcategory,
        accountId: expense.accountId,
        accountName: account.name,
        when: purchase,
        monthKey: monthKeyFromDate(purchase),
        amount,
        kind: 'card_fallback',
      });
      return out;
    }

    const dues = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    if (!dues.length) return out;
    const per = amount / n;
    for (const due of dues) {
      if (due.getFullYear() !== year) continue;
      if (due.getTime() > cutoffT) continue;
      out.push({
        expenseId: expense.id,
        description: expense.description,
        category: expense.category,
        subcategory: expense.subcategory,
        accountId: expense.accountId,
        accountName: account.name,
        when: due,
        monthKey: monthKeyFromDate(due),
        amount: per,
        kind: 'card_installment',
      });
    }
    return out;
  }

  // Empréstimo: parcela mensal por vencimento
  if (isLoanExpense(expense) && n >= 2) {
    const dues = getLoanInstallmentDueDates(purchase, n);
    const per = amount / n;
    for (const due of dues) {
      if (due.getFullYear() !== year) continue;
      if (due.getTime() > cutoffT) continue;
      out.push({
        expenseId: expense.id,
        description: expense.description,
        category: expense.category,
        subcategory: expense.subcategory,
        accountId: expense.accountId,
        accountName: account?.name ?? '—',
        when: due,
        monthKey: monthKeyFromDate(due),
        amount: per,
        kind: 'loan_installment',
      });
    }
    return out;
  }

  // Normal: pela data do lançamento
  if (purchase.getFullYear() !== year) return out;
  if (purchase.getTime() > cutoffT) return out;
  out.push({
    expenseId: expense.id,
    description: expense.description,
    category: expense.category,
    subcategory: expense.subcategory,
    accountId: expense.accountId,
    accountName: account?.name ?? '—',
    when: purchase,
    monthKey: monthKeyFromDate(purchase),
    amount,
    kind: 'regular',
  });
  return out;
}

function parseArgs(argv) {
  const args = { userId: null, userEmail: null, month: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--userId') args.userId = argv[++i];
    else if (a === '--userEmail') args.userEmail = argv[++i];
    else if (a === '--month') args.month = argv[++i]; // YYYY-MM
  }
  return args;
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const args = parseArgs(process.argv);

  // Escolhe o usuário com mais despesas (evita pegar usuário recém-criado sem dados)
  let user = null;
  if (args.userId) {
    user = (await query(`SELECT id, email, name FROM users WHERE id = $1`, [args.userId])).rows[0] || null;
  } else if (args.userEmail) {
    user =
      (await query(`SELECT id, email, name FROM users WHERE email = $1 LIMIT 1`, [args.userEmail]))
        .rows[0] || null;
  } else {
    const { rows: users } = await query(`SELECT id, email, name FROM users`);
    let bestCount = -1;
    for (const u of users) {
      const c = (await query(`SELECT COUNT(*)::int AS n FROM expenses WHERE user_id = $1`, [u.id])).rows[0]?.n ?? 0;
      if (c > bestCount) {
        bestCount = c;
        user = u;
      }
    }
  }
  if (!user) {
    console.log('Nenhum usuário encontrado.');
    return;
  }

  const [accRes, expRes] = await Promise.all([
    query(
      `SELECT
        id, user_id AS "userId", name, type,
        close_day AS "closeDay", due_day AS "dueDay"
       FROM accounts
       WHERE user_id = $1`,
      [user.id]
    ),
    query(
      `SELECT
        id,
        user_id AS "userId",
        account_id AS "accountId",
        category,
        subcategory,
        amount,
        description,
        date,
        is_paid AS "isPaid",
        installment_count AS "installmentCount",
        is_investment AS "isInvestment"
       FROM expenses
       WHERE user_id = $1`,
      [user.id]
    ),
  ]);
  const accounts = accRes.rows;
  const expenses = expRes.rows;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const rows = [];
  for (const e of expenses) {
    const acc = accountsById.get(e.accountId);
    rows.push(...explodeExpenseIntoYearContributions(e, acc, year, now));
  }

  const filteredRows = args.month
    ? rows.filter((r) => r.monthKey === args.month)
    : rows;

  filteredRows.sort((a, b) => a.when.getTime() - b.when.getTime());

  let total = 0;
  for (const r of filteredRows) total += Number(r.amount) || 0;

  console.log(`User: ${user.name ?? ''}${user.name ? ' ' : ''}<${user.email}> (${user.id})`);
  console.log(`Ano: ${year} | cutoff: ${endOfDay(now).toISOString()}`);
  if (args.month) console.log(`Mês: ${args.month}`);
  console.log('');

  for (const r of filteredRows) {
    const d = startOfDay(r.when).toLocaleDateString('pt-BR');
    const amt = (Number(r.amount) || 0).toFixed(2).replace('.', ',');
    const cat = r.subcategory ? `${r.category} > ${r.subcategory}` : r.category;
    console.log(`${d} | ${r.monthKey} | R$ ${amt} | ${r.kind} | ${r.accountName} | ${cat} | ${r.description} | ${r.expenseId}`);
  }

  const totalFmt = total.toFixed(2).replace('.', ',');
  console.log('');
  console.log(`TOTAL: R$ ${totalFmt}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


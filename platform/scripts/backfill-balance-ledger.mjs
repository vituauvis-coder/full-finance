/**
 * Reconstrói balance_ledger_entries para todos os usuários (após migração SQL).
 * Uso: npm run backfill:ledger
 */
import 'dotenv/config';
import { query } from '../../back/db.js';
import { rebuildBalanceLedgerForUser } from '../../back/balance-ledger.js';

const { rows } = await query(`SELECT id FROM users ORDER BY created_at ASC`);
let n = 0;
for (const r of rows) {
    await rebuildBalanceLedgerForUser(r.id);
    n++;
    console.log(`OK user ${r.id} (${n}/${rows.length})`);
}
console.log(`Concluído: ${n} usuário(s).`);

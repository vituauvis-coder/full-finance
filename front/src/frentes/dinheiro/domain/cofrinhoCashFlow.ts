import { COFRINHO_POOL_SUBCATEGORY, isCofrinhoPoolSubcategoryName } from './cofrinhoConstants';

/**
 * Dois caminhos válidos (nunca misturar o **mesmo dinheiro** nos dois):
 *
 * **A — Comissão / PLR (pool)**  
 * Saídas · Cofrinhos · **Pool** → Cofrinhos · **Distribuir** nas caixinhas.
 *
 * **B — Aporte já na caixinha (1 saída)**  
 * Saídas · Cofrinhos · subcategoria = **nome da caixinha** (Longo prazo, Trip…), ou  
 * Viagens · orçamento · **Aportar** (cria saída com `tripId` na caixinha-viagem).
 *
 * Dashboard / extrato: `cofrinhoSaidasTotals` + `cofrinhoSaidasExtrato` (ledger, sem rendimento).
 */
export const COFRINHO_CASH_FLOW_STEPS = [
    'A-pool-depois-distribuir',
    'B-aporte-direto-saidas',
    'B-aporte-viagem-orcamento'
] as const;

export function isCofrinhoPoolDepositSubcategory(subcategory: string | null | undefined): boolean {
    return isCofrinhoPoolSubcategoryName(subcategory);
}

export function isCofrinhoDirectBucketSubcategory(subcategory: string | null | undefined): boolean {
    const s = String(subcategory ?? '').trim();
    return s.length > 0 && s.toLowerCase() !== COFRINHO_POOL_SUBCATEGORY.toLowerCase();
}
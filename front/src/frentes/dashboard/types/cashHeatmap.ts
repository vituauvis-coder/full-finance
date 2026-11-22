export type DayAgg = {
    totalSaida: number;
    totalEntrada: number;
    temFatura: boolean;
    nivelSaida: number;
    faturas: { cardId: string; cardName: string; amount: number }[];
};

import type { LedgerVisualBucket } from '../domain/ledgerItemVisual';

export type DayDetailItem = {
    id: string;
    kind: 'invoice' | 'expense' | 'gain' | 'rateio';
    title: string;
    amount: number;
    bank: string;
    tag: string;
    status: string;
    pending: boolean;
    bucket?: LedgerVisualBucket;
    /** Saída fixa/fatura: confirmar débito no saldo. */
    cashOutConfirm?: { expenseId: string; periodKey: string };
    /** Estorno previsto (após rateio aceito) — só vira entrada real após confirmar o pagamento da saída. */
    estornoExpectativa?: boolean;
    /** Pedido de compartilhamento (rateio) ainda não aceito/recusado. */
    rateioPendente?: boolean;
    rateioDirection?: 'incoming' | 'outgoing';
};
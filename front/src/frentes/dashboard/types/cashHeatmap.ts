export type DayAgg = {
    totalSaida: number;
    totalEntrada: number;
    temFatura: boolean;
    nivelSaida: number;
    faturas: { cardId: string; cardName: string; amount: number }[];
};

export type DayDetailItem = {
    id: string;
    kind: 'invoice' | 'expense' | 'gain';
    title: string;
    amount: number;
    bank: string;
    tag: string;
    status: string;
    pending: boolean;
};
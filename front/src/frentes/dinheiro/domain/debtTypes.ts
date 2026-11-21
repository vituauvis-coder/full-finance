export type Debt = {
    id: string;
    company?: string;
    notes?: string | null;
    isClosed?: boolean;
    colorKey?: string;
    initialAmount?: number | null;
    lastOfferDiscountPercent?: number | null;
};

export type DebtUpdate = {
    id?: string;
    debtId?: string;
    amount?: number;
    date?: string | { seconds?: number };
    description?: string | null;
};
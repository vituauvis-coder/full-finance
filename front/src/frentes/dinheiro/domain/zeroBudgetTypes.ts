export type ZeroBudgetBlock = {
    id: string;
    name: string;
    categoryName?: string;
    categories?: string[];
    color?: string;
    allocatedAmount?: number;
};

export type ZeroBudgetTodo = {
    id: string;
    title: string;
    amount?: number;
    isPurchased?: boolean;
};
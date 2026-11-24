/** Paridade com `legacy-web/js/shared/table-pagination.js`. */

export const TABLE_PAGE_SIZES = [10, 15, 25, 100] as const;

export function parseTablePageSize(value: string | null | undefined, fallback = 25): number {
    const n = parseInt(String(value ?? ''), 10);
    return (TABLE_PAGE_SIZES as readonly number[]).includes(n) ? n : fallback;
}

export function tableSliceRange(page: number, pageSize: number, total: number) {
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    return { start, end };
}
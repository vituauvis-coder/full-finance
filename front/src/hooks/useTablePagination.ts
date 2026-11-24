import { useEffect, useMemo, useRef, useState } from 'react';
import { readBrandTablePageSize, writeBrandTablePageSize } from '../app/appBrand';
import { TABLE_PAGE_SIZES, parseTablePageSize, tableSliceRange } from '../lib/tablePagination';

export function useTablePagination(total: number, storageKey: string, defaultPageSize = 25) {
    const [pageSize, setPageSizeState] = useState(() =>
        parseTablePageSize(readBrandTablePageSize(storageKey), defaultPageSize)
    );
    const [page, setPage] = useState(1);
    const prevTotal = useRef(total);

    useEffect(() => {
        if (prevTotal.current !== total) {
            prevTotal.current = total;
            setPage(1);
        }
    }, [total]);

    const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const { start, end } = useMemo(
        () => tableSliceRange(page, pageSize, total),
        [page, pageSize, total]
    );

    const setPageSize = (size: number) => {
        const next = (TABLE_PAGE_SIZES as readonly number[]).includes(size) ? size : 25;
        setPageSizeState(next);
        writeBrandTablePageSize(storageKey, String(next));
        setPage(1);
    };

    return {
        page,
        pageSize,
        pageCount,
        start,
        end,
        setPage,
        setPageSize,
        next: () => setPage((p) => Math.min(pageCount, p + 1)),
        prev: () => setPage((p) => Math.max(1, p - 1))
    };
}
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/http';

export type CategoryRow = {
    id: string;
    name: string;
    type?: string;
    subcategories?: { id: string; name: string }[];
};

/** Banco e legado usam `GAIN` / `EXPENSE` (ver gain-categories.js, expense-categories.js). */
export function categoryKindFromType(type?: string | null): 'gain' | 'expense' | null {
    const raw = (type ?? '').trim();
    if (!raw) return null;
    const t = raw.toUpperCase();
    if (t === 'GAIN' || t === 'INCOME') return 'gain';
    if (t === 'EXPENSE') return 'expense';
    const lower = raw.toLowerCase();
    if (lower === 'gain' || lower === 'income') return 'gain';
    if (lower === 'expense') return 'expense';
    return null;
}

export function filterCategoriesByKind(list: CategoryRow[], kind: 'gain' | 'expense' | 'all'): CategoryRow[] {
    if (kind === 'all') return list;
    if (kind === 'gain') {
        return list.filter((c) => categoryKindFromType(c.type) === 'gain');
    }
    return list.filter((c) => {
        const k = categoryKindFromType(c.type);
        return k === 'expense' || k === null;
    });
}

export function useCategories(kind: 'gain' | 'expense' | 'all' = 'all') {
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await apiFetch<CategoryRow[]>('/api/categories');
            const list = Array.isArray(rows) ? rows : [];
            setCategories(filterCategoriesByKind(list, kind));
        } catch {
            setCategories([]);
        } finally {
            setLoading(false);
        }
    }, [kind]);

    useEffect(() => {
        void load();
    }, [load]);

    return { categories, loading, refresh: load };
}
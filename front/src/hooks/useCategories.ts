import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/http';

export type CategoryRow = {
    id: string;
    name: string;
    type?: string;
    subcategories?: { id: string; name: string }[];
};

export function useCategories(kind: 'gain' | 'expense' | 'all' = 'all') {
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await apiFetch<CategoryRow[]>('/api/categories');
            const list = Array.isArray(rows) ? rows : [];
            if (kind === 'all') {
                setCategories(list);
            } else {
                const t = kind === 'gain' ? 'income' : 'expense';
                setCategories(list.filter((c) => !c.type || c.type === t || c.type === kind));
            }
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
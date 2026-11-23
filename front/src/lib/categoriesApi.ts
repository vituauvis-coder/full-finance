import { apiFetch } from './http';

export type CategoryApiRow = {
    id: string;
    name: string;
    type?: string;
    isDefault?: boolean;
    subcategories?: { id: string; name: string; isDefault?: boolean }[];
};

export async function fetchAllCategories(): Promise<CategoryApiRow[]> {
    const rows = await apiFetch<CategoryApiRow[]>('/api/categories');
    return Array.isArray(rows) ? rows : [];
}

export async function createCategory(name: string, type: 'GAIN' | 'EXPENSE') {
    return apiFetch<CategoryApiRow>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type })
    });
}

export async function updateCategory(id: string, name: string, type: 'GAIN' | 'EXPENSE') {
    return apiFetch<CategoryApiRow>(`/api/categories/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), type })
    });
}

export async function deleteCategory(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createSubcategory(categoryId: string, name: string) {
    return apiFetch<{ id: string; name: string; categoryId: string }>(
        `/api/categories/${encodeURIComponent(categoryId)}/subcategories`,
        {
            method: 'POST',
            body: JSON.stringify({ name: name.trim() })
        }
    );
}

export async function updateSubcategory(id: string, name: string) {
    return apiFetch<{ id: string; name: string }>(`/api/subcategories/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() })
    });
}

export async function deleteSubcategory(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/subcategories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
/** Identificador curto estável para distinguir contas na UI (UUID completo no backend). */
export function accountShortId(id: string | undefined | null): string {
    const raw = String(id ?? '').trim();
    if (!raw) return '—';
    return raw.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function accountIdTitle(id: string | undefined | null): string {
    return `Conta ${accountShortId(id)} · id ${String(id ?? '').trim()}`;
}
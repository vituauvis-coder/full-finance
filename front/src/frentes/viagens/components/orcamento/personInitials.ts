/** Iniciais para avatar (ex.: Millena Santos → MS). */
export function personInitials(name: string | undefined | null): string {
    const parts = String(name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
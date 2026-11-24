/** Converte prazo da meta para YYYY-MM-DD (ISO, Date, DD/MM/AAAA, snake_case). */
export function normalizeCofrinhoGoalDeadlineIso(raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(raw).trim();
    const iso10 = s.length >= 10 ? s.slice(0, 10) : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso10)) return iso10;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return null;
}

/** Prazo de um registro de meta (camelCase ou snake_case). */
export function cofrinhoGoalDeadlineFromGoal(goal: unknown): string | null {
    if (!goal || typeof goal !== 'object') return null;
    const g = goal as { targetDeadline?: unknown; target_deadline?: unknown };
    return normalizeCofrinhoGoalDeadlineIso(g.targetDeadline ?? g.target_deadline);
}

/** Data limite da meta (YYYY-MM-DD ou ISO). */
export function formatCofrinhoGoalDeadlineLabel(raw: unknown): string {
    const iso = normalizeCofrinhoGoalDeadlineIso(raw);
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function cofrinhoGoalDeadlineInputValue(raw: unknown): string {
    return normalizeCofrinhoGoalDeadlineIso(raw) ?? '';
}
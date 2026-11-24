function deadlineToIsoDay(deadlineLike) {
    if (deadlineLike == null || deadlineLike === '') return null;
    if (deadlineLike instanceof Date && !Number.isNaN(deadlineLike.getTime())) {
        const y = deadlineLike.getFullYear();
        const m = String(deadlineLike.getMonth() + 1).padStart(2, '0');
        const d = String(deadlineLike.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(deadlineLike).trim();
    const iso10 = s.length >= 10 ? s.slice(0, 10) : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso10)) return iso10;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return null;
}

function parseDeadlineDate(deadlineLike) {
    const iso = deadlineToIsoDay(deadlineLike);
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Meses civis do mês atual até o mês do prazo (inclusive), mínimo 1. */
export function cofrinhoGoalMonthsUntilDeadline(deadlineLike, now = new Date()) {
    const end = parseDeadlineDate(deadlineLike);
    if (!end) return null;
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12, 0, 0, 0);
    if (endMonth < start) return null;
    const months =
        (endMonth.getFullYear() - start.getFullYear()) * 12 +
        (endMonth.getMonth() - start.getMonth()) +
        1;
    return Math.max(1, Math.min(120, months));
}

/**
 * @returns {{ perMonth: number, monthsLeft: number, remaining: number } | null}
 */
export function cofrinhoMonthlyPaceToGoal(targetAmount, accumulated, deadlineLike, now = new Date()) {
    const meta = Number(targetAmount) || 0;
    if (meta <= 0) return null;
    const acc = Number(accumulated) || 0;
    const remaining = Math.round((meta - acc) * 100) / 100;
    if (remaining <= 0.004) {
        return { perMonth: 0, monthsLeft: 0, remaining: 0 };
    }
    const monthsLeft = cofrinhoGoalMonthsUntilDeadline(deadlineLike, now);
    if (!monthsLeft) return null;
    const perMonth = Math.max(0, remaining / monthsLeft);
    return { perMonth, monthsLeft, remaining };
}
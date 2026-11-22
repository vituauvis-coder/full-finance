import { isAllYearsPeriod, isCivilYearPeriod, monthIndexFromPeriod } from '../../../lib/period';

export function yearMonthFromCivilPeriod(period: string, year: number, now = new Date()): string {
    if (isAllYearsPeriod(period)) {
        const y = now.getFullYear();
        return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (isCivilYearPeriod(period)) {
        const anchor = Math.min(11, Math.max(0, now.getMonth()));
        return `${year}-${String(anchor + 1).padStart(2, '0')}`;
    }
    const mi = monthIndexFromPeriod(period);
    return `${year}-${String(mi + 1).padStart(2, '0')}`;
}

export function referenceMonthToYearMonth(referenceMonth: string | null | undefined): string {
    if (!referenceMonth) return '';
    const m = String(referenceMonth).trim().match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    return toYearMonthKey(referenceMonth);
}

export function toYearMonthKey(dateLike: string | null | undefined): string {
    const s = String(dateLike ?? '').trim();
    const prefix = s.match(/^(\d{4})-(\d{2})/);
    if (prefix) return `${prefix[1]}-${prefix[2]}`;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function yearMonthToReferenceMonth(ym: string): string | null {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
    return `${ym}-01`;
}

/** Limita referência ao ano civil selecionado na toolbar. */
export function clampReferenceToYear(ym: string, civilYear: number): string {
    if (!/^\d{4}-\d{2}$/.test(ym)) {
        return `${civilYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    }
    const [, month] = ym.split('-');
    return `${civilYear}-${month}`;
}

export function formatYearMonthLabel(ym: string): string {
    const m = ym.match(/^(\d{4})-(\d{2})$/);
    if (!m) return ym;
    const months = [
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro'
    ];
    const mi = parseInt(m[2], 10) - 1;
    return `${months[mi] ?? m[2]} de ${m[1]}`;
}
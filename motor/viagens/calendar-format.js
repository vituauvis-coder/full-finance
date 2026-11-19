const TZ = 'America/Sao_Paulo';

export function lifeOSCalendarParts(date) {
    const d = date instanceof Date ? date : new Date(date);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [y, m, day] = formatter.format(d).split('-');
    return { year: Number(y), month: Number(m), day: Number(day) };
}

export function startOfDayInLifeOS(date) {
    const { year, month, day } = lifeOSCalendarParts(date);
    return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00-03:00`);
}

export function dayKey(date) {
    const { year, month, day } = lifeOSCalendarParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDayKey(key) {
    if (key == null || key === '') return null;
    if (key instanceof Date) {
        return Number.isNaN(key.getTime()) ? null : startOfDayInLifeOS(key);
    }
    if (typeof key !== 'string') return null;
    const trimmed = key.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const d = startOfDayInLifeOS(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza DATE do Postgres, ISO ou YYYY-MM-DD para chave de dia. */
export function toApiDayKey(raw) {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : dayKey(raw);
    }
    if (typeof raw === 'string') {
        const d10 = raw.trim().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d10)) return d10;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : dayKey(parsed);
    }
    return null;
}

export function monthAndYear(forMonthKey) {
    if (!forMonthKey || forMonthKey.length < 7) return '';
    const [y, m] = forMonthKey.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function addDays(date, days) {
    const base = startOfDayInLifeOS(date);
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + days);
    return startOfDayInLifeOS(next);
}

export function inclusiveDayCount(from, to) {
    const a = startOfDayInLifeOS(from).getTime();
    const b = startOfDayInLifeOS(to).getTime();
    if (b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
}
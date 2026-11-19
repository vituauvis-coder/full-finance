export function toDatetimeLocal(value?: string | null): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function flightStampParts(raw?: string | null): { date: string; time: string } | null {
    if (!raw?.trim()) return null;
    const local = toDatetimeLocal(raw);
    if (!local) return null;
    const [day, time] = local.split('T');
    const hhmm = (time ?? '').slice(0, 5);
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    if (Number.isNaN(dt.getTime())) return null;
    const date = dt
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
        .replace('.', '')
        .replace(/\sde\s/g, ' ')
        .trim();
    return { date, time: hhmm };
}

export function formatFlightStamp(raw?: string | null): string | null {
    const parts = flightStampParts(raw);
    if (parts) return `${parts.date} · ${parts.time}`;
    return raw?.trim() ? raw : null;
}

export function formatFlightSchedule(departs?: string | null, arrives?: string | null): string {
    const from = formatFlightStamp(departs);
    const to = formatFlightStamp(arrives);
    if (from && to) return `${from}  →  ${to}`;
    if (from) return `Partida ${from}`;
    if (to) return `Chegada ${to}`;
    return 'Sem datas';
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

export function parseFlightLocal(value?: string | null): Date | null {
    const local = toDatetimeLocal(value);
    if (!local) return null;
    const [day, time] = local.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatFlightLocal(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function flightDurationMs(dep?: string | null, arr?: string | null): number {
    const a = parseFlightLocal(dep);
    const b = parseFlightLocal(arr);
    if (!a || !b) return 0;
    const ms = b.getTime() - a.getTime();
    return ms > 0 ? ms : 0;
}

export function formatAirMs(ms: number): string | null {
    if (!(ms > 0)) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    if (h >= 24) {
        const days = Math.floor(h / 24);
        const rem = h % 24;
        if (rem === 0 && !m) return days === 1 ? '24h' : `${days}d`;
        return rem ? `${days}d ${rem}h` : `${days}d`;
    }
    return m ? `${h}h ${m}min` : `${h}h`;
}

export function flightDurationLabel(dep?: string | null, arr?: string | null): string | null {
    return formatAirMs(flightDurationMs(dep, arr));
}

export function simulationAirMs(sim: {
    departsAt?: string | null;
    arrivesAt?: string | null;
    isRoundTrip?: boolean;
    returnDepartsAt?: string | null;
    returnArrivesAt?: string | null;
}): number {
    let ms = flightDurationMs(sim.departsAt, sim.arrivesAt);
    if (sim.isRoundTrip) ms += flightDurationMs(sim.returnDepartsAt, sim.returnArrivesAt);
    return ms;
}

export function shiftKeepingDuration(
    prevDep: string | null,
    nextDep: string | null,
    arr: string | null
): string | null {
    if (!prevDep || !nextDep || !arr) return arr;
    const a = parseFlightLocal(prevDep);
    const b = parseFlightLocal(nextDep);
    const c = parseFlightLocal(arr);
    if (!a || !b || !c) return arr;
    const dur = c.getTime() - a.getTime();
    if (dur <= 0) return arr;
    return formatFlightLocal(new Date(b.getTime() + dur));
}

export function ensureAfter(anchor: string | null, value: string | null): string | null {
    if (!anchor || !value) return value;
    const a = parseFlightLocal(anchor);
    const b = parseFlightLocal(value);
    if (!a || !b) return value;
    if (b.getTime() > a.getTime()) return value;
    const next = new Date(a.getTime() + 24 * 3_600_000);
    next.setHours(b.getHours(), b.getMinutes(), 0, 0);
    if (next.getTime() <= a.getTime()) {
        return formatFlightLocal(new Date(a.getTime() + 60 * 60_000));
    }
    return formatFlightLocal(next);
}

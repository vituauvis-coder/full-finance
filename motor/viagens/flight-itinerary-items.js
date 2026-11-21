/** Prefix dos itens de voo injetados no planner a partir da simulação escolhida. */
export const FLIGHT_ITEM_PREFIX = 'rote-flight-';

const MANAGED_FLIGHT_SUFFIX_RE = /-(ida|volta)-(partida|chegada)$/;

export function isManagedFlightItemId(id) {
    const s = String(id ?? '');
    if (!s.startsWith(FLIGHT_ITEM_PREFIX)) return false;
    return MANAGED_FLIGHT_SUFFIX_RE.test(s.slice(FLIGHT_ITEM_PREFIX.length));
}

export function managedFlightSimId(id) {
    const s = String(id ?? '');
    if (!isManagedFlightItemId(s)) return '';
    return s.slice(FLIGHT_ITEM_PREFIX.length).replace(MANAGED_FLIGHT_SUFFIX_RE, '');
}

/**
 * Remove itens auto de voo e reinsere nas datas corretas (evita chegada duplicada).
 * @param {object[]} days
 * @param {Map<string, object[]>|Record<string, object[]>} injectionsByDay
 * @param {{ dayKeyOf?: (day: object) => string, upsert?: (items: object[], next: object, prev?: object) => object[] }} [opts]
 */
export function applyManagedFlightInjections(days, injectionsByDay, opts = {}) {
    const dayKeyOf =
        opts.dayKeyOf ??
        ((d) => String(d?.dayKey ?? d?.date ?? d?.day_key ?? '').slice(0, 10));
    const upsert =
        opts.upsert ??
        ((items, next) => {
            const idx = items.findIndex((i) => i.id === next.id);
            if (idx < 0) return [...items, next];
            return items.map((it, i) => (i === idx ? { ...it, ...next } : it));
        });

    const getInjections = (key) => {
        if (!key) return [];
        if (injectionsByDay instanceof Map) return injectionsByDay.get(key) ?? [];
        return injectionsByDay?.[key] ?? [];
    };

    const prevById = new Map();
    for (const day of days ?? []) {
        for (const it of day.items ?? []) {
            if (isManagedFlightItemId(it.id)) prevById.set(it.id, it);
        }
    }

    return (days ?? []).map((day) => {
        const key = dayKeyOf(day);
        let items = (day.items ?? []).filter((it) => !isManagedFlightItemId(it.id));
        for (const inj of getInjections(key)) {
            items = upsert(items, inj, prevById.get(inj.id));
        }
        items = [...items].sort((a, b) =>
            String(a.time ?? '99:99').localeCompare(String(b.time ?? '99:99'))
        );
        return { ...day, items };
    });
}

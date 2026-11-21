import { addDays, dayKey, inclusiveDayCount, parseDayKey, startOfDayInLifeOS } from './calendar-format.js';
import { daysUntilDayKey } from './atlas-home-countdown.js';
import { effectiveStatus, spent, capFor } from './trips-engine.js';
import { formatBRL } from './trips-engine.js';

/** Gastos diários de bolso — sem hospedagem, voos nem pagamentos pré-viagem (só categorias de dia a dia). */
export const TRIP_DIARY_DAILY_CATEGORIES = ['comida', 'transporte', 'passeios', 'extras'];

const HOME_TZ = 'America/Recife';
const HOME_CLOCK_LABEL = 'Recife';

const COUNTRY_TIME_ZONES = {
    brasil: 'America/Sao_Paulo',
    brazil: 'America/Sao_Paulo',
    china: 'Asia/Shanghai',
    espanha: 'Europe/Madrid',
    espana: 'Europe/Madrid',
    spain: 'Europe/Madrid',
    portugal: 'Europe/Lisbon',
    frança: 'Europe/Paris',
    franca: 'Europe/Paris',
    france: 'Europe/Paris',
    itália: 'Europe/Rome',
    italia: 'Europe/Rome',
    italy: 'Europe/Rome',
    alemanha: 'Europe/Berlin',
    germany: 'Europe/Berlin',
    japão: 'Asia/Tokyo',
    japao: 'Asia/Tokyo',
    japan: 'Asia/Tokyo',
    'estados unidos': 'America/New_York',
    'united states': 'America/New_York',
    // Cidades / aeroportos do roteiro
    madri: 'Europe/Madrid',
    madrid: 'Europe/Madrid',
    barcelona: 'Europe/Madrid',
    mad: 'Europe/Madrid',
    lisboa: 'Europe/Lisbon',
    lisbon: 'Europe/Lisbon',
    paris: 'Europe/Paris',
    roma: 'Europe/Rome',
    rome: 'Europe/Rome',
    berlim: 'Europe/Berlin',
    berlin: 'Europe/Berlin',
    xangai: 'Asia/Shanghai',
    shanghai: 'Asia/Shanghai',
    pequim: 'Asia/Shanghai',
    beijing: 'Asia/Shanghai',
    changsha: 'Asia/Shanghai',
    'pequim/beijing': 'Asia/Shanghai',
    'xangai/shanghai': 'Asia/Shanghai',
    pek: 'Asia/Shanghai',
    pvg: 'Asia/Shanghai',
    sha: 'Asia/Shanghai',
    toquio: 'Asia/Tokyo',
    tokyo: 'Asia/Tokyo',
    rec: 'America/Recife',
    recife: 'America/Recife',
    gru: 'America/Sao_Paulo',
    gig: 'America/Sao_Paulo',
    cnf: 'America/Sao_Paulo'
};

const BR_FALLBACK_TZ = 'America/Sao_Paulo';

/** @returns {string|null} null se desconhecido (não assume Brasil). */
export function guessTimeZoneForCountry(country) {
    const key = String(country ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    if (!key) return null;
    if (COUNTRY_TIME_ZONES[key]) return COUNTRY_TIME_ZONES[key];
    for (const [alias, tz] of Object.entries(COUNTRY_TIME_ZONES)) {
        if (alias.length >= 3 && key.includes(alias)) return tz;
    }
    return null;
}

function resolvePlaceTimeZone(label, country) {
    return (
        guessTimeZoneForCountry(label) ||
        guessTimeZoneForCountry(country) ||
        BR_FALLBACK_TZ
    );
}

/**
 * @param {Date} now
 * @returns {string}
 */
export function formatClockInZone(now, timeZone) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(now);
}

/**
 * Relógios para o feed: casa (Recife) + fusos únicos dos países do roteiro.
 * @param {string[]} countryLabels
 */
function isDomesticBrazilLabel(label) {
    const c = String(label ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    return !c || c.includes('brasil') || c === 'brazil' || c.includes('recife');
}

/**
 * Relógios: Recife + até 2 fusos internacionais (sem repetir SP/Recife/Brasil).
 * Aceita strings (país/cidade) ou `{ label, country }` — `country` resolve o fuso/bandeira.
 * @param {Array<string|{ label?: string; name?: string; country?: string }>} places
 */
export function tripFeedClockZones(places) {
    /** @type {Array<{ id: string; label: string; timeZone: string; flag: string }>} */
    const zones = [{ id: 'home', label: HOME_CLOCK_LABEL, timeZone: HOME_TZ, flag: '🇧🇷' }];
    const seen = new Set([HOME_TZ, 'America/Sao_Paulo']);
    for (const raw of places ?? []) {
        const entry =
            typeof raw === 'string'
                ? { label: raw.trim(), country: raw.trim() }
                : {
                      label: String(raw?.label ?? raw?.name ?? '').trim(),
                      country: String(raw?.country ?? raw?.label ?? raw?.name ?? '').trim()
                  };
        const label = entry.label;
        const country = entry.country || label;
        if (!label || isDomesticBrazilLabel(label)) continue;
        if (country && isDomesticBrazilLabel(country) && isDomesticBrazilLabel(label)) continue;
        const tz = resolvePlaceTimeZone(label, country);
        if (seen.has(tz)) continue;
        seen.add(tz);
        zones.push({
            id: `${label}-${tz}`,
            label: shortClockLabel(label, country),
            timeZone: tz,
            flag: countryFlagEmoji(label) || countryFlagEmoji(country)
        });
        if (zones.length >= 4) break;
    }
    return zones;
}

function shortClockLabel(label, country) {
    const c = String(label ?? '').trim();
    if (!c) return c;
    if (/^(mad|pek|pvg|sha|cdg|fco|lis)$/i.test(c)) {
        if (/mad/i.test(c)) return 'Madri';
        if (/pek|pvg|sha/i.test(c)) return 'China';
        if (/lis/i.test(c)) return 'Lisboa';
        if (/cdg/i.test(c)) return 'Paris';
        if (/fco/i.test(c)) return 'Roma';
    }
    if (/^china$/i.test(c)) return 'China';
    if (/espanha|espana|spain/i.test(c)) return 'Madri';
    if (/portugal/i.test(c)) return 'Lisboa';
    if (/fran[cç]a|france/i.test(c)) return 'Paris';
    if (country && /espanha|espana|spain/i.test(String(country)) && /^[A-Z]{3}$/.test(c)) return 'Madri';
    return c.length > 14 ? `${c.slice(0, 12)}…` : c;
}

export function countryFlagEmoji(country) {
    const c = String(country ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    if (c.includes('china') || c.includes('xangai') || c.includes('shanghai') || c.includes('pequim') || c.includes('beijing'))
        return '🇨🇳';
    if (c.includes('espan') || c === 'spain' || c.includes('madri') || c.includes('madrid') || c.includes('barcelona'))
        return '🇪🇸';
    if (c.includes('portugal') || c.includes('lisboa') || c.includes('lisbon')) return '🇵🇹';
    if (c.includes('fran') || c.includes('paris')) return '🇫🇷';
    if (c.includes('ital') || c.includes('roma') || c === 'rome') return '🇮🇹';
    if (c.includes('aleman') || c === 'germany' || c.includes('berlin')) return '🇩🇪';
    if (c.includes('jap') || c.includes('toquio') || c.includes('tokyo')) return '🇯🇵';
    if (c.includes('brasil') || c === 'brazil' || c.includes('recife')) return '🇧🇷';
    return '🌍';
}

/**
 * @param {string|null|undefined} startsOn
 * @param {string|null|undefined} endsOn
 * @param {string|null|undefined} statusOverride
 * @param {Date} [now]
 */
export function tripFeedCountdown({ startsOn, endsOn, statusOverride, now = new Date() }) {
    const status = effectiveStatus({ startsOn, endsOn, statusOverride, now });
    if (status === 'realizada') {
        return { status, label: 'Viagem concluída', days: null, mode: 'done' };
    }
    if (status === 'em_curso') {
        const days = daysUntilDayKey(endsOn, now);
        const d = days != null && days >= 0 ? days : null;
        if (d === 0) return { status, label: 'Último dia de viagem', days: 0, mode: 'until_end' };
        if (d != null) return { status, label: 'Faltam', days: d, suffix: 'para o fim', mode: 'until_end' };
        return { status, label: 'Viagem em andamento', days: null, mode: 'until_end' };
    }
    const days = daysUntilDayKey(startsOn, now);
    if (days == null) return { status, label: 'Defina a data de início', days: null, mode: 'no_dates' };
    if (days === 0) return { status, label: 'Sua viagem começa', days: 0, suffix: 'hoje', mode: 'until_start' };
    if (days < 0) return { status, label: 'Datas no passado', days: null, mode: 'past' };
    return { status, label: 'Faltam', days, suffix: 'para a viagem', mode: 'until_start' };
}

function sumDailyCaps(trip) {
    let total = 0;
    for (const cat of TRIP_DIARY_DAILY_CATEGORIES) {
        total += Math.max(0, capFor(trip, cat));
    }
    return total;
}

function sumDailySpent(trip) {
    let total = 0;
    for (const cat of TRIP_DIARY_DAILY_CATEGORIES) {
        total += spent(trip, { category: cat });
    }
    return total;
}

/**
 * Teto diário sugerido para gastos de bolso, repartindo o que falta nos dias restantes.
 * @param {{ payload?: object; budgetCaps?: object; budget_caps?: object }} trip
 * @param {string} dayKey
 * @param {string|null|undefined} startsOn
 * @param {string|null|undefined} endsOn
 * @param {Date} [now]
 */
export function tripDiaryDailyBudget({ trip, onDayKey, startsOn, endsOn, now = new Date() }) {
    const capTotal = sumDailyCaps(trip);
    if (capTotal <= 0) {
        return { amount: null, formatted: null, remainingTripDays: 0, note: 'Defina tetos em comida, transportes, passeios e extras.' };
    }
    const spentTotal = sumDailySpent(trip);
    const remaining = Math.max(0, capTotal - spentTotal);
    const start = parseDayKey(String(startsOn ?? '').trim());
    const end = parseDayKey(String(endsOn ?? '').trim());
    if (!start || !end || !onDayKey) {
        return { amount: null, formatted: null, remainingTripDays: 0, note: null };
    }
    const todayKey = dayKey(now);
    const tripDays = inclusiveDayCount(start, end);
    let remainingTripDays = 1;
    if (todayKey < String(startsOn).slice(0, 10)) {
        remainingTripDays = tripDays;
    } else if (todayKey > String(endsOn).slice(0, 10)) {
        remainingTripDays = 1;
    } else {
        const today = startOfDayInLifeOS(parseDayKey(todayKey) ?? now);
        const endDay = startOfDayInLifeOS(end);
        remainingTripDays = Math.max(1, Math.round((endDay.getTime() - today.getTime()) / 86400000) + 1);
    }
    const amount = Math.round((remaining / remainingTripDays) * 100) / 100;
    return {
        amount,
        formatted: formatBRL(amount),
        remainingTripDays,
        note: 'Média saudável para comida, transportes e extras — sem voos, hospedagens nem pré-pagamentos.'
    };
}

/**
 * Chaves de dias civis do intervalo da viagem (máx. 90).
 */
export function tripDiaryDayKeys(startsOn, endsOn) {
    const start = parseDayKey(String(startsOn ?? '').trim());
    const end = parseDayKey(String(endsOn ?? '').trim());
    if (!start || !end || end < start) return [];
    const keys = [];
    let cursor = startOfDayInLifeOS(start);
    const last = startOfDayInLifeOS(end);
    let guard = 0;
    while (cursor.getTime() <= last.getTime() && guard < 90) {
        keys.push(dayKey(cursor));
        cursor = addDays(cursor, 1);
        guard += 1;
    }
    return keys;
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function zonedParts(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    /** @type {Record<string, string>} */
    const out = {};
    for (const p of dtf.formatToParts(date)) {
        if (p.type !== 'literal') out[p.type] = p.value;
    }
    return out;
}

/**
 * Interpreta HH:MM como horário de parede em `timeZone` na data `dayKey` → instante UTC.
 * @param {string} dayKey
 * @param {number} hour
 * @param {number} minute
 * @param {string} timeZone
 */
function wallTimeInZoneToDate(dayKey, hour, minute, timeZone) {
    const parts = String(dayKey).split('-').map(Number);
    if (parts.length < 3) return null;
    const [y, mo, d] = parts;
    let utcMs = Date.UTC(y, mo - 1, d, hour, minute, 0);
    for (let i = 0; i < 3; i += 1) {
        const p = zonedParts(new Date(utcMs), timeZone);
        const asUtc = Date.UTC(
            Number(p.year),
            Number(p.month) - 1,
            Number(p.day),
            Number(p.hour) % 24,
            Number(p.minute),
            Number(p.second || 0)
        );
        const desired = Date.UTC(y, mo - 1, d, hour, minute, 0);
        utcMs += desired - asUtc;
    }
    return new Date(utcMs);
}

/**
 * @param {string} dayKey
 * @returns {string} ex. "20 de abr"
 */
export function formatTripDiaryDayShort(dayKey) {
    const parts = String(dayKey ?? '').split('-').map(Number);
    if (parts.length < 3 || !parts[0]) return String(dayKey ?? '');
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    if (Number.isNaN(d.getTime())) return String(dayKey ?? '');
    return d
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .replace('.', '');
}

/**
 * Converte hora local em um fuso para o mesmo instante em outro.
 * @param {string} hm — "14:30" ou "14:30:00"
 * @param {string} fromTz
 * @param {string} dayKey — data civil do horário de origem
 * @param {string} toTz
 * @returns {{ hm: string; dayKey: string; dateLabel: string }|null}
 */
export function convertLocalHmToZoneDetail(hm, fromTz, dayKey, toTz) {
    const raw = String(hm ?? '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!m || !dayKey || !fromTz || !toTz) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

    const padHm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (fromTz === toTz) {
        return { hm: padHm, dayKey: String(dayKey).slice(0, 10), dateLabel: formatTripDiaryDayShort(dayKey) };
    }

    const instant = wallTimeInZoneToDate(dayKey, hour, minute, fromTz);
    if (!instant) return null;
    const p = zonedParts(instant, toTz);
    const outKey = `${p.year}-${p.month}-${p.day}`;
    const outHm = new Intl.DateTimeFormat('pt-BR', {
        timeZone: toTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(instant);
    return { hm: outHm, dayKey: outKey, dateLabel: formatTripDiaryDayShort(outKey) };
}

/**
 * Converte hora local em um fuso para o mesmo instante em outro (rótulo HH:MM).
 * @returns {string|null}
 */
export function convertLocalHmToZone(hm, fromTz, dayKey, toTz) {
    return convertLocalHmToZoneDetail(hm, fromTz, dayKey, toTz)?.hm ?? null;
}

export const TRIP_DIARY_HOME_TZ = HOME_TZ;
export const TRIP_DIARY_HOME_LABEL = HOME_CLOCK_LABEL;
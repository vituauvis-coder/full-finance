/**
 * Feriados nacionais BR — paridade TripWorkHolidayCalendar.swift
 */

import { addDays, dayKey, parseDayKey, startOfDayInLifeOS } from './calendar-format.js';

const BRAZIL_AMERICA_TZ = new Set([
    'america/sao_paulo',
    'america/recife',
    'america/fortaleza',
    'america/belem',
    'america/maceio',
    'america/campo_grande',
    'america/cuiaba',
    'america/porto_velho',
    'america/rio_branco',
    'america/boa_vista',
    'america/manaus',
    'america/brasilia',
    'america/noronha',
    'america/bahia',
    'america/santarem',
    'america/araguaina'
]);

export function regionForWorkTimeZone(timeZoneID) {
    const id = String(timeZoneID ?? '').trim().toLowerCase();
    if (!id) return 'brazilNational';
    if (
        id.includes('sao_paulo') ||
        id.includes('recife') ||
        id.includes('fortaleza') ||
        id.includes('manaus') ||
        id.includes('brasilia') ||
        id.includes('noronha') ||
        id === 'america/bahia' ||
        BRAZIL_AMERICA_TZ.has(id)
    ) {
        return 'brazilNational';
    }
    return 'brazilNational';
}

function gregorianEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day, 12));
}

function fixedBrazilHolidays(year) {
    const fixed = [
        [1, 1],
        [4, 21],
        [5, 1],
        [9, 7],
        [10, 12],
        [11, 2],
        [11, 15],
        [11, 20],
        [12, 25]
    ];
    const keys = new Set();
    for (const [month, day] of fixed) {
        keys.add(dayKey(new Date(Date.UTC(year, month - 1, day, 12))));
    }
    return keys;
}

function movableBrazilHolidays(year) {
    const easter = gregorianEaster(year);
    const keys = new Set();
    keys.add(dayKey(addDays(easter, -47)));
    keys.add(dayKey(addDays(easter, -2)));
    keys.add(dayKey(addDays(easter, 60)));
    return keys;
}

/** Chaves YYYY-MM-DD (LifeOS/BR) de feriados nacionais no intervalo. */
export function brazilNationalDayKeys(from, to) {
    const first = startOfDayInLifeOS(from);
    const last = startOfDayInLifeOS(to);
    if (last < first) return new Set();

    const years = new Set();
    let cursor = first;
    while (cursor.getTime() <= last.getTime()) {
        years.add(cursor.getUTCFullYear());
        const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12));
        cursor = startOfDayInLifeOS(nextMonth);
        if (cursor.getTime() > last.getTime() && years.size > 20) break;
    }
    const lastYear = last.getUTCFullYear();
    years.add(lastYear);
    years.add(first.getUTCFullYear());

    let keys = new Set();
    for (const year of years) {
        for (const k of fixedBrazilHolidays(year)) keys.add(k);
        for (const k of movableBrazilHolidays(year)) keys.add(k);
    }

    const inRange = new Set();
    for (const key of keys) {
        const d = parseDayKey(key);
        if (!d) continue;
        const t = startOfDayInLifeOS(d).getTime();
        if (t >= first.getTime() && t <= last.getTime()) inRange.add(key);
    }
    return inRange;
}

export function officialWorkHolidayKeys(tripStart, tripEnd, workTimeZone) {
    if (regionForWorkTimeZone(workTimeZone) !== 'brazilNational') return new Set();
    return brazilNationalDayKeys(tripStart, tripEnd);
}
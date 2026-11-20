/**
 * Dias remotos — paridade com TripScenarioEngine.swift (remoteStats / travelDayKeys).
 */

import { addDays, dayKey, parseDayKey, startOfDayInLifeOS } from './calendar-format.js';
import { officialWorkHolidayKeys } from './trip-work-holiday-calendar.js';

const AUTO_LAYOVER_HOURS = 12;
const LATE_TRAVEL_DEPARTURE_HOUR = 19;

const WEEKDAY_NAME_TO_SWIFT = {
    Sunday: 1,
    Monday: 2,
    Tuesday: 3,
    Wednesday: 4,
    Thursday: 5,
    Friday: 6,
    Saturday: 7
};

export function normalizeRemotePolicy(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const weekdays = r.weekdays;
    return {
        authorization: r.authorization ?? 'pending',
        workTimeZone: r.work_time_zone ?? r.workTimeZone ?? 'America/Sao_Paulo',
        weekdays: Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : [2, 3, 4, 5, 6],
        holidays: Array.isArray(r.holidays) ? r.holidays.map(String) : [],
        windows: Array.isArray(r.windows) ? r.windows : [],
        suggestEligibleWeekdays:
            r.suggest_eligible_weekdays ?? r.suggestEligibleWeekdays ?? true
    };
}

function parseInstant(local) {
    if (!local) return null;
    const s = String(local).trim();
    if (s.includes('T')) {
        const d = new Date(s.length === 16 ? `${s}:00` : s);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return parseDayKey(s);
}

function hopCountry(hop) {
    return String(
        hop.destinationCountry ??
            hop.destination_country ??
            hop.destinationCity ??
            ''
    ).trim();
}

function hopOriginCountry(hop) {
    return String(hop.originCountry ?? hop.origin_country ?? hop.originCity ?? '').trim();
}

export function hopInstantsFromScenario(hops) {
    const list = hops ?? [];
    const out = [];
    for (const hop of list) {
        const depart = parseInstant(hop.departsAt ?? hop.departs_at);
        const arrive = parseInstant(hop.arrivesAt ?? hop.arrives_at);
        if (!depart || !arrive || arrive <= depart) continue;
        out.push({
            hop,
            depart,
            arrive,
            destinationCountry: hopCountry(hop),
            originCountry: hopOriginCountry(hop),
            destinationIsLayover: Boolean(hop.destinationIsLayover ?? hop.destination_is_layover)
        });
    }
    return out;
}

function swiftWeekday(date, timeZone) {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
    return WEEKDAY_NAME_TO_SWIFT[name] ?? 1;
}

function hourInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false
    }).formatToParts(date);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
    return Number(h);
}

function vacationEndsOnKey(period) {
    const startKey = String(period.startsOn ?? period.starts_on ?? '').trim().slice(0, 10);
    const days = Math.max(1, Number(period.days ?? 0));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
    const start = parseDayKey(startKey);
    if (!start) return null;
    const end = addDays(start, days - 1);
    return dayKey(end);
}

function vacationDayKeys(vacations) {
    const keys = new Set();
    for (const period of vacations ?? []) {
        const startKey = String(period.startsOn ?? period.starts_on ?? '').trim().slice(0, 10);
        const days = Math.max(1, Number(period.days ?? 1));
        const start = parseDayKey(startKey);
        if (!start) continue;
        for (let i = 0; i < days; i++) {
            keys.add(dayKey(addDays(start, i)));
        }
    }
    return keys;
}

export function expandedTripStart(hopStart, vacations) {
    let start = startOfDayInLifeOS(hopStart);
    const hopDay = start.getTime();
    for (const period of vacations ?? []) {
        const day = parseDayKey(period.startsOn ?? period.starts_on);
        if (!day) continue;
        const vacationStart = startOfDayInLifeOS(day);
        if (vacationStart.getTime() < hopDay) start = vacationStart;
    }
    return start;
}

export function expandedTripEnd(hopEnd, vacations) {
    let end = hopEnd;
    for (const period of vacations ?? []) {
        const endKey = vacationEndsOnKey(period);
        if (!endKey) continue;
        const endDay = parseDayKey(endKey);
        if (!endDay) continue;
        const endOfVacation = addDays(startOfDayInLifeOS(endDay), 1);
        endOfVacation.setTime(endOfVacation.getTime() - 1000);
        if (endOfVacation > end) end = endOfVacation;
    }
    return end;
}

function travelDayKeys(instants) {
    const keys = new Set();
    for (const instant of instants) {
        let cursor = startOfDayInLifeOS(instant.depart);
        const last = startOfDayInLifeOS(instant.arrive);
        while (cursor.getTime() <= last.getTime()) {
            keys.add(dayKey(cursor));
            cursor = addDays(cursor, 1);
        }
    }
    return keys;
}

function hasLateDepartureOnDay(dayStart, instants, timeZone) {
    const dayEnd = addDays(startOfDayInLifeOS(dayStart), 1);
    for (const instant of instants) {
        const dep = instant.depart;
        if (dep < dayStart || dep >= dayEnd) continue;
        if (hourInZone(dep, timeZone) >= LATE_TRAVEL_DEPARTURE_HOUR) return true;
    }
    return false;
}

function countryDuringTravel(date, instants) {
    const dayStart = startOfDayInLifeOS(date);
    const dayEnd = addDays(dayStart, 1);
    for (const instant of instants) {
        if (instant.depart < dayEnd && instant.arrive >= dayStart) {
            const c = instant.destinationCountry;
            if (c) return c;
        }
    }
    return null;
}

function staySegment(instant, depart) {
    const hours = (depart.getTime() - instant.arrive.getTime()) / 3600000;
    const isLayover = instant.destinationIsLayover || hours < AUTO_LAYOVER_HOURS;
    return {
        country: instant.destinationCountry,
        arrive: instant.arrive,
        depart,
        isLayover
    };
}

export function staysFromInstants(instants, tripEnd) {
    const stays = [];
    for (let i = 0; i < instants.length; i++) {
        const instant = instants[i];
        const nextDepart = i + 1 < instants.length ? instants[i + 1].depart : null;
        if (!nextDepart || nextDepart <= instant.arrive) continue;
        stays.push(staySegment(instant, nextDepart));
    }
    const last = instants[instants.length - 1];
    if (last && tripEnd.getTime() > last.arrive.getTime() + 3600000) {
        stays.push(staySegment(last, tripEnd));
    }
    return stays;
}

function dayContainsStay(stays, cursor) {
    const next = addDays(startOfDayInLifeOS(cursor), 1);
    return stays.some(
        (stay) =>
            !stay.isLayover &&
            cursor.getTime() < stay.depart.getTime() &&
            next.getTime() > stay.arrive.getTime()
    );
}

function stayCountryOnDay(stays, cursor, instants, onTravel) {
    const next = addDays(startOfDayInLifeOS(cursor), 1);
    const stay = stays.find(
        (s) => !s.isLayover && cursor.getTime() < s.depart.getTime() && s.arrive.getTime() < next.getTime()
    );
    let country = stay?.country ?? '';
    if (!country && onTravel) {
        country = countryDuringTravel(cursor, instants) ?? '';
    }
    return country;
}

function scheduledRemoteKeys(remote) {
    const keys = new Set();
    for (const window of remote.windows ?? []) {
        const start = parseDayKey(window.startsOn ?? window.starts_on);
        const endKey = String(window.endsOn ?? window.ends_on ?? window.startsOn ?? window.starts_on ?? '').trim();
        const end = parseDayKey(endKey);
        if (!start || !end) continue;
        let cursor = startOfDayInLifeOS(start);
        const last = startOfDayInLifeOS(end);
        while (cursor.getTime() <= last.getTime()) {
            keys.add(dayKey(cursor));
            cursor = addDays(cursor, 1);
        }
    }
    return keys;
}

/**
 * @param {{ hops?: unknown[]; vacations?: unknown[]; remote?: unknown }} scenario
 * @param {Date|null} hopStart
 * @param {Date|null} hopEnd
 */
export function buildRemoteSnapshot(scenario, hopStart, hopEnd) {
    const remote = normalizeRemotePolicy(scenario.remote);
    const empty = {
        possibleWeekdays: 0,
        scheduledDays: 0,
        byCountry: {},
        afterVacationByCountry: {},
        suggestedDays: [],
        authorization: remote.authorization
    };
    if (!hopStart || !hopEnd || hopEnd <= hopStart) {
        return { remote: empty, remoteDayKeys: new Set() };
    }
    if (remote.authorization === 'not_allowed') {
        return { remote: { ...empty, authorization: 'not_allowed' }, remoteDayKeys: new Set() };
    }

    const vacations = scenario.vacations ?? [];
    const instants = hopInstantsFromScenario(scenario.hops);
    const tripStart = expandedTripStart(hopStart, vacations);
    const tripEnd = expandedTripEnd(hopEnd, vacations);
    const stays = staysFromInstants(instants, tripEnd);
    const vacationKeys = vacationDayKeys(vacations);
    const travelKeys = travelDayKeys(instants);
    const timeZone = remote.workTimeZone;
    const holidayKeys = new Set([
        ...officialWorkHolidayKeys(tripStart, tripEnd, timeZone),
        ...remote.holidays
    ]);
    const scheduled = scheduledRemoteKeys(remote);
    const weekdays = new Set(remote.weekdays);

    const lastVacationKeys = vacations.map(vacationEndsOnKey).filter(Boolean).sort();
    const lastVacation = lastVacationKeys.length ? lastVacationKeys[lastVacationKeys.length - 1] : null;

    const possible = [];
    const byCountry = {};
    const afterByCountry = {};

    let cursor = startOfDayInLifeOS(tripStart);
    const last = startOfDayInLifeOS(tripEnd);
    while (cursor.getTime() <= last.getTime()) {
        const key = dayKey(cursor);
        const weekday = swiftWeekday(cursor, timeZone);
        const inStay = dayContainsStay(stays, cursor);
        const onTravel = travelKeys.has(key);
        let eligible =
            remote.suggestEligibleWeekdays &&
            weekdays.has(weekday) &&
            !vacationKeys.has(key) &&
            !holidayKeys.has(key) &&
            (inStay || onTravel);
        if (eligible && onTravel && hasLateDepartureOnDay(cursor, instants, timeZone)) {
            eligible = false;
        }
        if (eligible) {
            possible.push(key);
            const stayCountry = stayCountryOnDay(stays, cursor, instants, onTravel);
            if (stayCountry) {
                byCountry[stayCountry] = (byCountry[stayCountry] ?? 0) + 1;
                if (lastVacation && key > lastVacation) {
                    afterByCountry[stayCountry] = (afterByCountry[stayCountry] ?? 0) + 1;
                }
            }
        }
        cursor = addDays(cursor, 1);
    }

    for (const key of scheduled) {
        if (possible.includes(key) || vacationKeys.has(key) || holidayKeys.has(key)) continue;
        const day = parseDayKey(key);
        if (!day) continue;
        if (!weekdays.has(swiftWeekday(day, timeZone))) continue;
        possible.push(key);
    }

    const scheduledCount = [...scheduled].filter(
        (key) => possible.includes(key) || (!vacationKeys.has(key) && !travelKeys.has(key))
    ).length;

    const remoteDayKeys = new Set(possible);

    return {
        remote: {
            authorization: remote.authorization,
            possibleWeekdays: possible.length,
            scheduledDays: scheduledCount,
            byCountry,
            afterVacationByCountry: afterByCountry,
            suggestedDays: [...possible].sort()
        },
        remoteDayKeys
    };
}
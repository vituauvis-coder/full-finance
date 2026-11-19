import type { TripFlightSimulation } from '../types';

const KEY = 'viagens:miles-calc-saves';
const MAX = 30;

export type MilesCalcSave = {
    id: string;
    savedAt: string;
    title: string;
    sim: TripFlightSimulation;
};

function read(): MilesCalcSave[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function write(list: MilesCalcSave[]) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function loadMilesCalcSaves(): MilesCalcSave[] {
    return read();
}

export function pushMilesCalcSave(title: string, sim: TripFlightSimulation): MilesCalcSave[] {
    const next: MilesCalcSave = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        title,
        sim
    };
    const list = [next, ...read().filter((s) => s.id !== next.id)];
    write(list);
    return list;
}

export function putMilesCalcSave(id: string, title: string, sim: TripFlightSimulation): MilesCalcSave[] {
    const next: MilesCalcSave = {
        id,
        savedAt: new Date().toISOString(),
        title,
        sim
    };
    const rest = read().filter((s) => s.id !== id);
    const list = [next, ...rest];
    write(list);
    return list;
}

export function dropMilesCalcSave(id: string): MilesCalcSave[] {
    const list = read().filter((s) => s.id !== id);
    write(list);
    return list;
}

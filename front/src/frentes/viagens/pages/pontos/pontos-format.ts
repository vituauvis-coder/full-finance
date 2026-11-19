export type MilesProgram = {
    id: string;
    name: string;
    brand: string;
    issuer?: string;
    unit?: string;
    notes?: string;
    expiresOn?: string | null;
    balance: number;
    available?: number;
    committed?: number;
    milheiro?: string;
    invested?: string;
    transferBonusPercent?: number;
    clubActive?: boolean;
    clubFeeBrl?: string;
    clubStartedOn?: string | null;
    clubPointsPerMonth?: number;
    clubBonusPerMonth?: number;
    buyMilheiro?: string;
};

export type ConversionRate = {
    fromProgramId: string;
    toProgramId: string;
    conversionFrom: number;
    conversionTo: number;
    bonusPercent: number;
};

export const MOVEMENT_LABEL: Record<string, string> = {
    acumulo: 'Acúmulo',
    clube: 'Clube',
    compra: 'Compra',
    bonus: 'Bônus',
    transferencia: 'Transferência',
    transferencia_saida: 'Transferência · saída',
    transferencia_entrada: 'Transferência · entrada',
    emissao: 'Emissão',
    expiracao: 'Expiração',
    ajuste: 'Ajuste'
};

export const STATUS_LABEL: Record<string, string> = {
    rascunho: 'Rascunho',
    reservada: 'Reservada',
    emitida: 'Emitida'
};

export const RATIO_PRESETS: Array<[number, number]> = [
    [1, 1],
    [1, 2],
    [2, 1],
    [5, 2],
    [3, 1]
];

export const BONUS_PRESETS = [0, 10, 20, 25, 30, 40, 50, 60, 80, 100];

export function formatPts(n: number) {
    return Math.round(Number(n) || 0).toLocaleString('pt-BR');
}

export function parsePts(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
}

export function parseDecimal(raw: string) {
    const t = raw.trim().replace(/\s/g, '');
    if (!t || t === '-' || t === ',') return 0;
    const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
    return Number.isFinite(n) ? n : 0;
}

export function formatDecimal(n: number, max = 4) {
    if (!Number.isFinite(n) || n === 0) return '';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: max, minimumFractionDigits: 0 });
}

export function movementLabel(type: string) {
    return MOVEMENT_LABEL[type] ?? type;
}

export function statusLabel(status: string) {
    return STATUS_LABEL[status] ?? status;
}

export function isDebit(type: string, pointsSign?: number) {
    if (type === 'ajuste') return pointsSign === -1;
    return type === 'transferencia_saida' || type === 'emissao' || type === 'expiracao';
}

export function milesError(e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg || msg === 'Not Found' || msg === 'Não encontrado' || /not found/i.test(msg)) {
        return 'A Central de pontos não respondeu. Atualize a página.';
    }
    return msg;
}

export function dateLabel(iso: string | null | undefined) {
    const s = String(iso ?? '').slice(0, 10);
    if (!s) return '';
    const [y, m, d] = s.split('-');
    if (!d) return s;
    return `${d}/${m}/${y}`;
}

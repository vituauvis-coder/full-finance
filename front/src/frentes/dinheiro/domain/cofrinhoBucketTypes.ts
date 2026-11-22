import type { BucketColorKey } from './cofrinhoConstants';
import type { CofrinhoBucket } from './cofrinhoAggregations';

/** Tipos criados pelo usuário (`kind` em `cofrinho_buckets`). Viagem é só via ficha. */
export const USER_COFRINHO_KINDS = [
    'emergencia',
    'curto_prazo',
    'investimento',
    'longo_prazo',
    'objetivo',
    'reserve'
] as const;

export type UserCofrinhoKind = (typeof USER_COFRINHO_KINDS)[number];

/** Tipos no formulário da caixinha (inclui viagem com vínculo à ficha). */
export const BUCKET_FORM_KINDS = [...USER_COFRINHO_KINDS, 'viagem'] as const;

export type BucketFormKind = (typeof BUCKET_FORM_KINDS)[number];

export type CofrinhoKindKey = UserCofrinhoKind | 'viagem';

export type CofrinhoKindMeta = {
    value: CofrinhoKindKey;
    label: string;
    shortLabel: string;
    hint: string;
    icon: string;
    defaultColor: BucketColorKey;
    sectionId: string;
};

export const COFRINHO_KIND_META: Record<CofrinhoKindKey, CofrinhoKindMeta> = {
    emergencia: {
        value: 'emergencia',
        label: 'Emergência',
        shortLabel: 'Emergência',
        hint: 'Reserva para imprevistos e segurança financeira.',
        icon: 'shield',
        defaultColor: 'emerald',
        sectionId: 'emergencia'
    },
    curto_prazo: {
        value: 'curto_prazo',
        label: 'Curto prazo',
        shortLabel: 'Curto prazo',
        hint: 'Metas para os próximos meses.',
        icon: 'event',
        defaultColor: 'cyan',
        sectionId: 'curto_prazo'
    },
    investimento: {
        value: 'investimento',
        label: 'Investimento',
        shortLabel: 'Investimento',
        hint: 'Aportes com foco em rendimento.',
        icon: 'trending_up',
        defaultColor: 'violet',
        sectionId: 'investimento'
    },
    longo_prazo: {
        value: 'longo_prazo',
        label: 'Longo prazo',
        shortLabel: 'Longo prazo',
        hint: 'Construção patrimonial — anos à frente.',
        icon: 'schedule',
        defaultColor: 'indigo',
        sectionId: 'longo_prazo'
    },
    objetivo: {
        value: 'objetivo',
        label: 'Objetivo livre',
        shortLabel: 'Objetivo',
        hint: 'Qualquer meta com nome e cor próprios.',
        icon: 'flag',
        defaultColor: 'amber',
        sectionId: 'objetivo'
    },
    reserve: {
        value: 'reserve',
        label: 'Reserva geral',
        shortLabel: 'Reserva',
        hint: 'Caixinha genérica (legado ou uso livre).',
        icon: 'savings',
        defaultColor: 'fuchsia',
        sectionId: 'reserva'
    },
    viagem: {
        value: 'viagem',
        label: 'Viagem',
        shortLabel: 'Viagem',
        hint: 'Mesma secção «Viagens» — vincule à ficha para aportes e gastos da viagem.',
        icon: 'flight',
        defaultColor: 'rose',
        sectionId: 'viagem'
    }
};

/** Ordem das secções na página. */
export const COFRINHO_SECTION_ORDER = [
    'emergencia',
    'curto_prazo',
    'investimento',
    'longo_prazo',
    'objetivo',
    'reserva',
    'viagem'
] as const;

export const COFRINHO_SECTION_TITLES: Record<string, string> = {
    emergencia: 'Emergência',
    curto_prazo: 'Curto prazo',
    investimento: 'Investimento',
    longo_prazo: 'Longo prazo',
    objetivo: 'Objetivos',
    reserva: 'Reservas',
    viagem: 'Viagens'
};

export function resolveCofrinhoKind(bucket: CofrinhoBucket): CofrinhoKindKey {
    if (bucket.tripId || String(bucket.kind ?? '').trim() === 'viagem') return 'viagem';
    const k = String(bucket.kind ?? 'reserve').trim() as CofrinhoKindKey;
    if (k in COFRINHO_KIND_META) return k;
    return 'reserve';
}

export function cofrinhoKindMeta(bucket: CofrinhoBucket): CofrinhoKindMeta {
    return COFRINHO_KIND_META[resolveCofrinhoKind(bucket)];
}

export function normalizeUserCofrinhoKind(input: string | undefined | null): UserCofrinhoKind {
    const k = String(input ?? 'objetivo').trim() as UserCofrinhoKind;
    return (USER_COFRINHO_KINDS as readonly string[]).includes(k) ? k : 'objetivo';
}

export function isTripLockedBucket(bucket: CofrinhoBucket): boolean {
    return resolveCofrinhoKind(bucket) === 'viagem';
}
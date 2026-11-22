import type { CofrinhoBucket } from './cofrinhoAggregations';
import {
    COFRINHO_KIND_META,
    COFRINHO_SECTION_ORDER,
    COFRINHO_SECTION_TITLES,
    resolveCofrinhoKind
} from './cofrinhoBucketTypes';

export type CofrinhoBucketSection = {
    id: string;
    title: string;
    buckets: CofrinhoBucket[];
};

/** Agrupa caixinhas por tipo (emergência, investimento, viagens…). */
export function groupCofrinhoBucketsForDisplay(buckets: CofrinhoBucket[]): CofrinhoBucketSection[] {
    const bySection = new Map<string, CofrinhoBucket[]>();
    for (const b of buckets ?? []) {
        const sectionId = COFRINHO_KIND_META[resolveCofrinhoKind(b)].sectionId;
        const list = bySection.get(sectionId) ?? [];
        list.push(b);
        bySection.set(sectionId, list);
    }
    const sections: CofrinhoBucketSection[] = [];
    for (const id of COFRINHO_SECTION_ORDER) {
        const list = bySection.get(id);
        if (!list?.length) continue;
        list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
        sections.push({
            id,
            title: COFRINHO_SECTION_TITLES[id] ?? id,
            buckets: list
        });
    }
    return sections;
}

export function isViagemCofrinhoBucket(bucket: CofrinhoBucket): boolean {
    return resolveCofrinhoKind(bucket) === 'viagem';
}

function bucketTripId(bucket: CofrinhoBucket): string {
    const raw = bucket as CofrinhoBucket & { trip_id?: string };
    return String(bucket.tripId ?? raw.trip_id ?? '').trim();
}

/** Uma entrada por nome exibido — prioriza caixinha ligada à viagem (`trip_id`). */
export function dedupeCofrinhoBucketsByDisplayName(buckets: CofrinhoBucket[]): CofrinhoBucket[] {
    const groups = new Map<string, CofrinhoBucket[]>();
    for (const b of buckets ?? []) {
        const key = String(b.name ?? '').trim().toLowerCase() || `__id:${b.id}`;
        const list = groups.get(key) ?? [];
        list.push(b);
        groups.set(key, list);
    }
    const rank = (x: CofrinhoBucket) => {
        const trip = bucketTripId(x);
        const kind = String(x.kind ?? '').trim();
        return (trip ? 4 : 0) + (kind === 'viagem' ? 2 : 0) + (Number(x.sortOrder) || 0) * 0.001;
    };
    const picked = Array.from(groups.values()).map((list) =>
        list.reduce((best, cur) => (rank(cur) > rank(best) ? cur : best))
    );
    return picked.sort(
        (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name ?? '').localeCompare(String(b.name ?? ''))
    );
}
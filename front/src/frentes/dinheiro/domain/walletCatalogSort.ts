import type { WalletCatalogGroup } from './walletCatalogGroups';

export type WalletCatalogSortMeta = {
    dueDay: number;
    invoice: number;
};

export function catalogGroupSortMeta(group: WalletCatalogGroup): WalletCatalogSortMeta {
    let dueDay = 999;
    let invoice = 0;

    for (const facet of group.facets) {
        if (facet.kind !== 'credit') continue;
        const d = facet.dueDay != null ? Number(facet.dueDay) : 999;
        const inv = facet.invoice;
        if (d < dueDay || (d === dueDay && inv > invoice)) {
            dueDay = d;
            invoice = inv;
        }
    }

    if (dueDay === 999 && group.row.kind === 'orphan-credit') {
        const card = group.row.card;
        dueDay = card.dueDay != null ? Number(card.dueDay) : 999;
        const creditFacet = group.facets.find((f) => f.kind === 'credit');
        if (creditFacet && creditFacet.kind === 'credit') invoice = creditFacet.invoice;
    }

    return { dueDay, invoice };
}

export function sortWalletCatalogGroups(groups: WalletCatalogGroup[]): WalletCatalogGroup[] {
    return [...groups].sort((a, b) => {
        const sa = catalogGroupSortMeta(a);
        const sb = catalogGroupSortMeta(b);

        const aHasDue = sa.dueDay < 999;
        const bHasDue = sb.dueDay < 999;
        if (aHasDue && !bHasDue) return -1;
        if (!aHasDue && bHasDue) return 1;

        if (sa.dueDay !== sb.dueDay) return sa.dueDay - sb.dueDay;
        if (sb.invoice !== sa.invoice) return sb.invoice - sa.invoice;

        return a.title.localeCompare(b.title, 'pt-BR');
    });
}
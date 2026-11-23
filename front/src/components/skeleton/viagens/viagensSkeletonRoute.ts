import { isNavigableTripId } from '../../../frentes/shell/config/sidebarNav';

export type ViagensTripSkeletonVariant = 'atlas' | 'orcamento' | 'transporte' | 'hospedagens' | 'roteiros' | 'ficha';

export function viagensSkeletonVariantFromLocation(pathname: string, search: string): ViagensTripSkeletonVariant | null {
    const path = pathname.replace(/\/+$/, '') || '/';

    if (path === '/viagens') return 'atlas';

    const tripMatch = path.match(/^\/viagens\/([^/]+)(?:\/(.*))?$/);
    if (!tripMatch) return null;
    const tripSlug = tripMatch[1];
    const rest = tripMatch[2] ?? '';

    if (!isNavigableTripId(tripSlug)) return null;

    if (rest.startsWith('transporte')) return 'transporte';
    if (rest.startsWith('hospedagens')) return 'hospedagens';
    if (rest.startsWith('roteiros')) return 'roteiros';

    const modulo = new URLSearchParams(search).get('modulo');
    if (modulo === 'orcamento') return 'orcamento';

    if (!rest) return 'ficha';

    return null;
}
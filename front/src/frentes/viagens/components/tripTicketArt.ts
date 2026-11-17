import type { Trip } from '../types';

export const TICKET_ART_PUBLIC_DIR = '/viagens/ticket-art';

/** Sinônimos → nome do arquivo (sem .png). */
const ART_ALIASES: Record<string, string> = {
    natal: 'natal-rn',
    'natal-rn': 'natal-rn',
    'natal-rn-brasil': 'natal-rn',
    china: 'china',
    chine: 'china',
    guilin: 'china',
    'rio-grande-do-norte': 'natal-rn'
};

function slugify(input: string): string {
    return input
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function collectSlugs(trip: Trip): string[] {
    const out: string[] = [];
    const title = trip.title?.trim();
    if (title) out.push(slugify(title));
    for (const d of trip.payload?.destinations ?? []) {
        if (d.name?.trim()) out.push(slugify(d.name));
        if (d.country?.trim()) out.push(slugify(d.country));
    }
    return out;
}

/** Primeiro arquivo candidato na pasta pública (404 → o card oculta a arte). */
export function tripTicketArtCandidate(trip: Trip): { url: string; file: string } | null {
    for (const slug of collectSlugs(trip)) {
        const file = ART_ALIASES[slug] ?? slug;
        return { url: `${TICKET_ART_PUBLIC_DIR}/${file}.png`, file };
    }
    return null;
}

export function suggestTicketArtFilename(destinationName: string): string {
    return `${slugify(destinationName)}.png`;
}
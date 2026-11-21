import {
    coerceLatinGeocodeLabel,
    countryDisplayName,
    curateGeocodeHits,
    formatNominatimPlace,
    geocodeAliasFallback,
    geocodeHitDisplayLabel,
    hasCjkScript,
    isChinaRegion,
    isLatinUiText,
    nearestGeocodeAliasHits,
    pickAddressDisplayLine,
    expandGeocodeQuery,
    isGenericCountryGeocodeHit,
    pickPlaceDisplayName,
    parentCityFromLatinAddress,
    refineGeocodeCityLabel,
    resolveMapPinSuggestions,
    snapGreatWallPlace
} from '@motor/viagens/place-display.js';
import type { GeocodeHit } from '../types';

export {
    coerceLatinGeocodeLabel,
    countryDisplayName,
    curateGeocodeHits,
    expandGeocodeQuery,
    formatNominatimPlace,
    geocodeAliasFallback,
    geocodeHitDisplayLabel,
    isGenericCountryGeocodeHit,
    hasCjkScript,
    isChinaRegion,
    isLatinUiText,
    nearestGeocodeAliasHits,
    pickAddressDisplayLine,
    pickPlaceDisplayName,
    parentCityFromLatinAddress,
    refineGeocodeCityLabel,
    resolveMapPinSuggestions,
    snapGreatWallPlace
};

const GEO_KIND_LABELS: Record<string, string> = {
    country: 'País',
    city: 'Cidade',
    neighborhood: 'Bairro',
    region: 'Região',
    restaurant: 'Restaurante',
    shopping: 'Shopping',
    shop: 'Loja',
    attraction: 'Ponto turístico',
    airport: 'Aeroporto',
    poi: 'Ponto'
};

const GEO_KIND_ICONS: Record<string, string> = {
    country: 'public',
    city: 'location_city',
    neighborhood: 'holiday_village',
    region: 'map',
    restaurant: 'restaurant',
    shopping: 'local_mall',
    shop: 'storefront',
    attraction: 'attractions',
    airport: 'flight',
    poi: 'place'
};

const PLACE_KINDS = new Set(['city', 'neighborhood', 'region', 'airport']);
const POI_KINDS = new Set(['attraction', 'restaurant', 'shopping', 'shop', 'poi']);

/** Rótulo da lista de busca (pt-BR, sem hanzi solto). */
export function formatGeocodeHitOption(
    hit: GeocodeHit,
    query = ''
): { title: string; subtitle: string; badge: string; badgeTone: 'place' | 'poi'; icon: string } {
    const { title, subtitle } = geocodeHitDisplayLabel(hit, query);
    const kind = String(hit.kind ?? 'poi').trim() || 'poi';
    const badge = GEO_KIND_LABELS[kind] ?? GEO_KIND_LABELS.poi;
    const badgeTone = PLACE_KINDS.has(kind) ? 'place' : POI_KINDS.has(kind) ? 'poi' : 'poi';
    const icon = GEO_KIND_ICONS[kind] ?? GEO_KIND_ICONS.poi;
    return { title, subtitle, badge, badgeTone, icon };
}

/** Rótulo de stay/endereço já salvo no registro (regra China). */
export function formatStayPlaceLine(stay: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
}): string {
    const country = stay.country ?? '';
    const name = pickPlaceDisplayName({
        name: stay.name,
        countryName: country
    });
    const addr = pickAddressDisplayLine({
        displayName: [stay.address, stay.city, country].filter(Boolean).join(', '),
        countryName: country
    });
    return addr || name;
}
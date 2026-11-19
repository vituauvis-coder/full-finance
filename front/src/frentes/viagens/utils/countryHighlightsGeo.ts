import { geoNamesForCountryLabels } from '@motor/viagens/trip-countries.js';

const WORLD_GEO_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

let worldGeoCache: GeoJSON.FeatureCollection | null = null;
let worldGeoPromise: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadWorldCountries(): Promise<GeoJSON.FeatureCollection> {
    if (worldGeoCache) return worldGeoCache;
    if (!worldGeoPromise) {
        worldGeoPromise = fetch(WORLD_GEO_URL)
            .then((r) => {
                if (!r.ok) throw new Error('countries_geo_failed');
                return r.json();
            })
            .then((data) => {
                worldGeoCache = data as GeoJSON.FeatureCollection;
                return worldGeoCache;
            });
    }
    return worldGeoPromise;
}

const emptyCollection = (): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: []
});

export async function buildCountryHighlightCollection(
    countryLabels: string[]
): Promise<GeoJSON.FeatureCollection> {
    if (!countryLabels.length) return emptyCollection();
    try {
        const world = await loadWorldCountries();
        const geoNames = new Set(geoNamesForCountryLabels(countryLabels));
        const features = world.features.filter((f) => {
            const name = String((f.properties as { name?: string })?.name ?? '');
            return geoNames.has(name);
        });
        return { type: 'FeatureCollection', features };
    } catch (e) {
        console.warn('[viagens-countries]', e);
        return emptyCollection();
    }
}
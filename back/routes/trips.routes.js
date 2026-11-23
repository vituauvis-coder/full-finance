import * as repo from '../trips-repository.js';
import {
    enrichTripSummary,
    normalizeTrip,
    sortedTrips,
    visits
} from '../../motor/viagens/trips-engine.js';
import { snapshot, snapshots, winner } from '../../motor/viagens/trip-scenario-engine.js';
import { airportLabel, searchAirportsCatalog } from '../../motor/viagens/airports-catalog.js';
import { fetchTaxFxQuotes } from '../../motor/viagens/fx-quotes.js';
import { syncTripExpensesToFinance } from '../trip-finance-sync.js';
import { listTripFinanceMovements } from '../trip-finance-household.js';
import { ensureViagensCatalogForHousehold } from '../trip-finance-categories.js';
import {
    coerceLatinGeocodeLabel,
    expandGeocodeQuery,
    formatNominatimPlace,
    curateGeocodeHits,
    geocodeAliasFallback,
    hasCjkScript,
    inferGeocodeKind,
    isGenericCountryGeocodeHit,
    nominatimLatinAddressLine,
    pickPlaceDisplayName,
    queryAlignedPlaceName,
    queryDisplayTitle,
    rankGeocodeHits,
    resolveMapPinSuggestions,
    sanitizeGeocodeCity
} from '../../motor/viagens/place-display.js';

function finalizeGeocodeHitName(item, hitDraft, qRaw) {
    let name = coerceLatinGeocodeLabel(hitDraft, qRaw);
    if (!name.trim() || hasCjkScript(name)) {
        const aligned = queryAlignedPlaceName(item, qRaw);
        if (aligned) name = aligned;
    }
    if (!name.trim() || hasCjkScript(name)) {
        const draft = { ...hitDraft, address: hitDraft.address || nominatimLatinAddressLine(item) };
        name = queryDisplayTitle(draft, qRaw);
    }
    return name.trim();
}

function mergePayload(serverPayload, clientPayload) {
    if (!clientPayload || typeof clientPayload !== 'object') return serverPayload ?? {};
    const base = serverPayload && typeof serverPayload === 'object' ? serverPayload : {};
    return { ...base, ...clientPayload };
}

export function registerTripsRoutes(app, { requireAuth }) {
    app.get('/api/trips', requireAuth, async (req, res) => {
        try {
            const rows = await repo.listTripsForUser(req.session.userId);
            const trips = sortedTrips(rows).map((row) => enrichTripSummary(row));
            const visitList = visits(rows);
            res.json({ trips, visits: visitList });
        } catch (e) {
            console.error('GET /api/trips', e);
            res.status(500).json({ error: 'Erro ao listar viagens' });
        }
    });

    app.post('/api/trips', requireAuth, async (req, res) => {
        try {
            const row = await repo.createTrip(req.session.userId, { title: req.body?.title });
            res.status(201).json({ trip: enrichTripSummary(row) });
        } catch (e) {
            console.error('POST /api/trips', e);
            res.status(500).json({ error: 'Erro ao criar viagem' });
        }
    });

    app.post('/api/trips/scenario/snapshot', requireAuth, async (req, res) => {
        const { scenario, scenarios, criteria } = req.body ?? {};
        if (scenarios) {
            const list = snapshots(scenarios);
            const win = winner(list, criteria ?? []);
            return res.json({ snapshots: list, winnerId: win });
        }
        if (scenario) {
            return res.json({ snapshot: snapshot(scenario) });
        }
        return res.status(400).json({ error: 'scenario ou scenarios obrigatório' });
    });

    app.get('/api/trips/airports/search', requireAuth, async (req, res) => {
        const q = String(req.query.q ?? '').trim();
        if (q.length < 1) return res.json({ hits: [] });
        const catalog = searchAirportsCatalog(q, 8).map((a) => ({
            iata: a.iata,
            name: a.name,
            city: a.city,
            country: a.country,
            label: airportLabel(a),
            kind: 'airport'
        }));
        if (catalog.length >= 4 || q.length < 2) {
            return res.json({ hits: catalog });
        }
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('q', /aeroporto|airport/i.test(q) ? q : `${q} airport`);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '6');
            const response = await fetch(url, {
                headers: { 'User-Agent': 'MeuMalote/1.0 (viagens)' }
            });
            const data = await response.json();
            const extra = (data ?? []).map((item) => {
                const city = item.display_name?.split(',')[0] ?? item.name ?? q;
                return {
                    iata: '',
                    name: city,
                    city,
                    country: item.display_name?.split(',').at(-1)?.trim() ?? '',
                    label: city,
                    kind: 'place',
                    latitude: Number(item.lat),
                    longitude: Number(item.lon)
                };
            });
            const seen = new Set(catalog.map((h) => h.label.toLowerCase()));
            const merged = [...catalog];
            for (const hit of extra) {
                if (seen.has(hit.label.toLowerCase())) continue;
                seen.add(hit.label.toLowerCase());
                merged.push(hit);
            }
            res.json({ hits: merged.slice(0, 8) });
        } catch (err) {
            console.error('[airports]', err);
            res.json({ hits: catalog });
        }
    });

    app.get('/api/trips/geocode/search', requireAuth, async (req, res) => {
        const qRaw = String(req.query.q ?? '').trim();
        if (qRaw.length < 2) return res.json({ hits: [] });
        const q = expandGeocodeQuery(qRaw);
        const countrycodes = String(req.query.countrycodes ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z,]/g, '');
        const biasLat = Number(req.query.lat);
        const biasLon = Number(req.query.lon ?? req.query.lng);
        // Alias assertivo (cidade/atração conhecida) sem depender do Nominatim.
        const aliasHit = geocodeAliasFallback(qRaw);
        if (aliasHit && (aliasHit.kind === 'attraction' || aliasHit.kind === 'city')) {
            const curatedAlias = curateGeocodeHits(qRaw, [aliasHit], {
                limit: aliasHit.kind === 'attraction' ? 1 : 3,
                countryCodes: countrycodes
            });
            if (curatedAlias.length) {
                return res.json({ hits: curatedAlias });
            }
        }
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('q', q);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '14');
            url.searchParams.set('addressdetails', '1');
            url.searchParams.set('namedetails', '1');
            url.searchParams.set('dedupe', '1');
            url.searchParams.set('accept-language', 'en,pt-BR,pt');
            if (countrycodes) url.searchParams.set('countrycodes', countrycodes);
            if (Number.isFinite(biasLat) && Number.isFinite(biasLon)) {
                const pad = 5.5;
                url.searchParams.set(
                    'viewbox',
                    `${biasLon - pad},${biasLat - pad},${biasLon + pad},${biasLat + pad}`
                );
                url.searchParams.set('bounded', '0');
            }
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MeuMalote/1.0 (viagens)',
                    'Accept-Language': 'en,pt-BR,pt;q=0.9'
                }
            });
            const data = await response.json();
            const seen = new Set();
            const hits = [];
            for (const item of data ?? []) {
                const osmKey =
                    item.osm_type && item.osm_id != null ? `${item.osm_type}:${item.osm_id}` : `p:${item.place_id}`;
                if (seen.has(osmKey)) continue;
                seen.add(osmKey);
                const fmt = formatNominatimPlace(item, qRaw);
                const latinAddress = fmt.address && !hasCjkScript(fmt.address) ? fmt.address : nominatimLatinAddressLine(item);
                const hitDraft = {
                    name: fmt.name || (item.display_name?.split(',')[0] ?? item.name ?? q),
                    country: fmt.country || (item.display_name?.split(',').at(-1)?.trim() ?? ''),
                    address: latinAddress || fmt.address,
                    city: fmt.city,
                    countryCode: fmt.countryCode,
                    importance: Number(item.importance ?? 0)
                };
                const name = finalizeGeocodeHitName(item, hitDraft, qRaw);
                const addr = item?.address ?? {};
                let cityLine = fmt.city;
                const countryLine = hitDraft.country;
                const cityCandidates = [
                    addr.city,
                    addr.town,
                    addr.municipality,
                    addr.state,
                    addr.county,
                    addr.region
                ]
                    .map((s) => String(s ?? '').trim())
                    .filter(Boolean);
                if (
                    !cityLine ||
                    (countryLine &&
                        String(cityLine).toLowerCase() === String(countryLine).toLowerCase())
                ) {
                    cityLine =
                        cityCandidates.find(
                            (c) =>
                                c &&
                                String(c).toLowerCase() !== String(countryLine ?? '').toLowerCase()
                        ) ?? cityLine;
                }
                const addressLine = latinAddress || nominatimLatinAddressLine(item) || fmt.address;

                cityLine = sanitizeGeocodeCity(cityLine, hitDraft.country);

                const hitOut = {
                    name,
                    country: hitDraft.country,
                    address: addressLine,
                    city: cityLine,
                    countryCode: fmt.countryCode,
                    latitude: Number(item.lat),
                    longitude: Number(item.lon),
                    kind: fmt.kind || inferGeocodeKind(item),
                    category: item.class ?? '',
                    placeType: item.type ?? '',
                    importance: Number(item.importance ?? 0)
                };
                if (!name.trim() || isGenericCountryGeocodeHit(hitOut, qRaw)) continue;
                const labelKey = `${name}:${fmt.country}:${Math.round(Number(item.lat) * 1000)}`;
                if (seen.has(`l:${labelKey}`)) continue;
                seen.add(`l:${labelKey}`);
                hits.push(hitOut);
            }
            let ranked = curateGeocodeHits(qRaw, hits, { limit: 8, countryCodes: countrycodes });
            if (
                ranked.length > 0 &&
                ranked.every((h) => isGenericCountryGeocodeHit(h, qRaw)) &&
                countrycodes
            ) {
                const url2 = new URL(url);
                url2.searchParams.delete('countrycodes');
                const response2 = await fetch(url2, {
                    headers: {
                        'User-Agent': 'MeuMalote/1.0 (viagens)',
                        'Accept-Language': 'en,pt-BR,pt;q=0.9'
                    }
                });
                const data2 = await response2.json();
                const hits2 = [];
                const seen2 = new Set();
                for (const item of data2 ?? []) {
                    const osmKey =
                        item.osm_type && item.osm_id != null
                            ? `${item.osm_type}:${item.osm_id}`
                            : `p:${item.place_id}`;
                    if (seen2.has(osmKey)) continue;
                    seen2.add(osmKey);
                    const fmt = formatNominatimPlace(item, qRaw);
                    const latinAddress = fmt.address && !hasCjkScript(fmt.address) ? fmt.address : nominatimLatinAddressLine(item);
                    const hitDraft = {
                        name: fmt.name || (item.display_name?.split(',')[0] ?? item.name ?? q),
                        country: fmt.country,
                        address: latinAddress || fmt.address,
                        city: fmt.city,
                        countryCode: fmt.countryCode,
                        importance: Number(item.importance ?? 0)
                    };
                    const name = finalizeGeocodeHitName(item, hitDraft, qRaw);
                    const citySan = sanitizeGeocodeCity(fmt.city, hitDraft.country);
                    const hitOut = {
                        name,
                        country: hitDraft.country,
                        address: latinAddress || fmt.address,
                        city: citySan,
                        countryCode: fmt.countryCode,
                        latitude: Number(item.lat),
                        longitude: Number(item.lon),
                        kind: fmt.kind || inferGeocodeKind(item),
                        category: item.class ?? '',
                        placeType: item.type ?? '',
                        importance: Number(item.importance ?? 0)
                    };
                    if (isGenericCountryGeocodeHit(hitOut, qRaw)) continue;
                    hits2.push(hitOut);
                }
                const retryRanked = curateGeocodeHits(qRaw, hits2, {
                    limit: 8,
                    countryCodes: countrycodes
                });
                if (retryRanked.some((h) => !isGenericCountryGeocodeHit(h, qRaw))) ranked = retryRanked;
            }
            ranked = curateGeocodeHits(qRaw, ranked, { limit: 5, countryCodes: countrycodes });
            res.json({ hits: ranked });
        } catch (err) {
            console.error('[geocode]', err);
            res.json({ hits: [] });
        }
    });

    app.get('/api/trips/geocode/reverse', requireAuth, async (req, res) => {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon ?? req.query.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.json({ hits: [] });
        }
        const reverseHits = [];
        try {
            const url = new URL('https://nominatim.openstreetmap.org/reverse');
            url.searchParams.set('lat', String(lat));
            url.searchParams.set('lon', String(lon));
            url.searchParams.set('format', 'json');
            url.searchParams.set('addressdetails', '1');
            url.searchParams.set('namedetails', '1');
            url.searchParams.set('zoom', '12');
            url.searchParams.set('accept-language', 'en,pt-BR,pt');
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MeuMalote/1.0 (viagens)',
                    'Accept-Language': 'en,pt-BR,pt;q=0.9'
                }
            });
            const item = await response.json();
            if (item && !item.error) {
                const fmt = formatNominatimPlace(item, '');
                const latinAddress =
                    fmt.address && !hasCjkScript(fmt.address) ? fmt.address : nominatimLatinAddressLine(item);
                const hitDraft = {
                    name: fmt.name || (item.display_name?.split(',')[0] ?? item.name ?? ''),
                    country: fmt.country || (item.display_name?.split(',').at(-1)?.trim() ?? ''),
                    address: latinAddress || fmt.address,
                    city: fmt.city,
                    countryCode: fmt.countryCode,
                    importance: Number(item.importance ?? 0)
                };
                const name = finalizeGeocodeHitName(item, hitDraft, hitDraft.name);
                const cityLine = sanitizeGeocodeCity(fmt.city, hitDraft.country);
                const hitOut = {
                    name,
                    country: hitDraft.country,
                    address: latinAddress || fmt.address,
                    city: cityLine,
                    countryCode: fmt.countryCode,
                    latitude: Number(item.lat ?? lat),
                    longitude: Number(item.lon ?? lon),
                    kind: fmt.kind || inferGeocodeKind(item),
                    category: item.class ?? '',
                    placeType: item.type ?? '',
                    importance: Number(item.importance ?? 0)
                };
                if (name.trim() && !isGenericCountryGeocodeHit(hitOut, name)) {
                    reverseHits.push(hitOut);
                }
                // Também sobe a cidade do endereço quando o reverse cai em rua/bairro.
                const addr = item.address ?? {};
                const cityCand = [addr.city, addr.town, addr.municipality, addr.state]
                    .map((s) => String(s ?? '').trim())
                    .find(Boolean);
                const cityOk =
                    cityCand &&
                    !isGenericCountryGeocodeHit(
                        {
                            name: cityCand,
                            country: hitOut.country,
                            countryCode: hitOut.countryCode,
                            kind: 'city'
                        },
                        cityCand
                    );
                if (cityOk) {
                    reverseHits.push({
                        name: cityCand,
                        country: hitOut.country,
                        address: `${cityCand}, ${hitOut.country}`.trim(),
                        city: cityCand,
                        countryCode: hitOut.countryCode,
                        latitude: Number(item.lat ?? lat),
                        longitude: Number(item.lon ?? lon),
                        kind: 'city',
                        importance: Number(item.importance ?? 0) + 0.05
                    });
                }
            }
        } catch (err) {
            console.warn('[geocode/reverse]', err?.message ?? err);
        }
        const hits = resolveMapPinSuggestions(lat, lon, reverseHits, { limit: 3 });
        res.json({ hits });
    });

    /** Traçado real de estrada/caminhada (OSRM) p/ trechos terrestres no mapa do roteiro. */
    app.get('/api/trips/road-route', requireAuth, async (req, res) => {
        const fromLng = Number(req.query.fromLng ?? req.query.from_lng);
        const fromLat = Number(req.query.fromLat ?? req.query.from_lat);
        const toLng = Number(req.query.toLng ?? req.query.to_lng);
        const toLat = Number(req.query.toLat ?? req.query.to_lat);
        const profile = String(req.query.profile ?? 'driving').trim() === 'foot' ? 'foot' : 'driving';
        if (
            ![fromLng, fromLat, toLng, toLat].every((n) => Number.isFinite(n)) ||
            Math.abs(fromLat) > 90 ||
            Math.abs(toLat) > 90 ||
            Math.abs(fromLng) > 180 ||
            Math.abs(toLng) > 180
        ) {
            return res.json({ coordinates: [], durationSec: null, distanceM: null });
        }
        try {
            const url = new URL(
                `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}`
            );
            url.searchParams.set('overview', 'full');
            url.searchParams.set('geometries', 'geojson');
            const response = await fetch(url, {
                headers: { 'User-Agent': 'MeuMalote/1.0 (viagens roteiros)' }
            });
            if (!response.ok) {
                return res.json({ coordinates: [], durationSec: null, distanceM: null });
            }
            const data = await response.json();
            const route = data?.routes?.[0];
            const coordinates = Array.isArray(route?.geometry?.coordinates)
                ? route.geometry.coordinates
                : [];
            res.json({
                coordinates,
                durationSec: Number.isFinite(route?.duration) ? route.duration : null,
                distanceM: Number.isFinite(route?.distance) ? route.distance : null
            });
        } catch (err) {
            console.warn('[road-route]', err?.message ?? err);
            res.json({ coordinates: [], durationSec: null, distanceM: null });
        }
    });

    app.get('/api/trips/places/lodging-search', requireAuth, async (req, res) => {
        const q = String(req.query.q ?? '').trim();
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lon ?? req.query.lng);
        const radiusKm = Math.min(30, Math.max(1, Number(req.query.radiusKm) || 8));
        if (q.length < 2 && !(Number.isFinite(lat) && Number.isFinite(lng))) {
            return res.json({ hits: [] });
        }
        const ua = { 'User-Agent': 'MeuMalote/1.0 (viagens hospedagens)' };
        const hits = [];
        const seen = new Set();

        const pushHit = (hit) => {
            const key = `${hit.name}:${Math.round((hit.latitude ?? 0) * 1000)}`;
            if (seen.has(key)) return;
            seen.add(key);
            hits.push(hit);
        };

        const lodgingQuery = /hotel|hostel|pousada|motel|hosped|airbnb|albergue|resort|inn|suíte|suite/i.test(q);

        if (q.length >= 2) {
            try {
                const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
                nomUrl.searchParams.set('q', q);
                nomUrl.searchParams.set('format', 'json');
                nomUrl.searchParams.set('limit', '12');
                nomUrl.searchParams.set('addressdetails', '1');
                nomUrl.searchParams.set('namedetails', '1');
                const nomRes = await fetch(nomUrl, { headers: { ...ua, 'Accept-Language': 'local' } });
                if (nomRes.ok) {
                    const nomData = await nomRes.json();
                    for (const item of nomData ?? []) {
                        const cat = String(item.category ?? '');
                        const typ = String(item.type ?? '');
                        const classType = String(item.class ?? '');
                        const isLodging =
                            /hotel|hostel|guest|motel|accommodation|chalet|apartment/i.test(typ) ||
                            /hotel|hostel|guest_house|motel|apartment/i.test(cat) ||
                            /hotel|hostel|guest_house|motel/i.test(classType) ||
                            lodgingQuery;
                        if (!isLodging && !/tourism|amenity/i.test(cat) && !/tourism|amenity/i.test(classType)) {
                            continue;
                        }
                        const fmt = formatNominatimPlace(item, qRaw);
                        pushHit({
                            name: fmt.name || item.name || (item.display_name?.split(',')[0] ?? q),
                            address: fmt.address || item.display_name || '',
                            city: fmt.city || item.address?.town || item.address?.village || '',
                            country: fmt.country || item.address?.country || '',
                            latitude: Number(item.lat),
                            longitude: Number(item.lon),
                            osmType: item.osm_type,
                            osmId: String(item.osm_id ?? ''),
                            source: 'nominatim',
                            kind: 'lodging'
                        });
                    }
                }
            } catch (err) {
                console.warn('[lodging-search] nominatim', err?.message ?? err);
            }
        }

        let searchLat = lat;
        let searchLng = lng;
        if (!(Number.isFinite(searchLat) && Number.isFinite(searchLng)) && q.length >= 2) {
            try {
                const geoUrl = new URL('https://nominatim.openstreetmap.org/search');
                geoUrl.searchParams.set('q', q);
                geoUrl.searchParams.set('format', 'json');
                geoUrl.searchParams.set('limit', '1');
                const geoRes = await fetch(geoUrl, { headers: ua });
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    const g0 = geoData?.[0];
                    if (g0) {
                        searchLat = Number(g0.lat);
                        searchLng = Number(g0.lon);
                    }
                }
            } catch (err) {
                console.warn('[lodging-search] geocode anchor', err?.message ?? err);
            }
        }

        if (Number.isFinite(searchLat) && Number.isFinite(searchLng)) {
            const radiusM = Math.round(radiusKm * 1000);
            const query = `[out:json][timeout:20];(node["tourism"~"hotel|hostel|motel|guest_house|apartment"](around:${radiusM},${searchLat},${searchLng});way["tourism"~"hotel|hostel|motel|guest_house|apartment"](around:${radiusM},${searchLat},${searchLng}););out center 20;`;
            const overpassUrls = [
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter'
            ];
            for (const overpassUrl of overpassUrls) {
                try {
                    const overpass = await fetch(overpassUrl, {
                        method: 'POST',
                        headers: { ...ua, 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `data=${encodeURIComponent(query)}`
                    });
                    if (!overpass.ok) continue;
                    const oData = await overpass.json();
                    if (oData?.remark && !oData?.elements) continue;
                    for (const el of oData?.elements ?? []) {
                        const latEl = el.lat ?? el.center?.lat;
                        const lonEl = el.lon ?? el.center?.lon;
                        if (!Number.isFinite(latEl) || !Number.isFinite(lonEl)) continue;
                        const tags = el.tags ?? {};
                        const cc =
                        tags['ISO3166-1:alpha2'] ??
                        (String(tags['addr:country'] ?? '').toUpperCase() === 'CHINA' ? 'CN' : tags['addr:country']);
                        const name =
                            pickPlaceDisplayName({
                                name: tags.name,
                                nameEn: tags['name:en'],
                                nameLatin: tags['name:latin'],
                                countryCode: cc,
                                countryName: tags['addr:country']
                            }) || tags['addr:street'] || 'Hospedagem';
                        pushHit({
                            name,
                            address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
                                .filter(Boolean)
                                .join(', '),
                            city: tags['addr:city'] ?? tags['addr:town'] ?? '',
                            country: tags['addr:country'] ?? '',
                            latitude: latEl,
                            longitude: lonEl,
                            osmType: el.type,
                            osmId: String(el.id ?? ''),
                            stars: tags.stars ? Number(tags.stars) : null,
                            source: 'overpass',
                            kind: tags.tourism ?? 'hotel'
                        });
                    }
                    if (hits.length) break;
                } catch (err) {
                    console.warn('[lodging-search] overpass', overpassUrl, err?.message ?? err);
                }
            }
        }

        res.json({ hits: hits.slice(0, 24) });
    });

    app.get('/api/trips/:id', requireAuth, async (req, res) => {
        try {
            let row = await repo.getTripForUser(req.session.userId, req.params.id);
            if (!row) return res.status(404).json({ error: 'Não encontrada' });
            try {
                await ensureViagensCatalogForHousehold(req.session.userId, row.title);
            } catch (catalogErr) {
                console.warn('ensure viagens catalog', catalogErr?.message ?? catalogErr);
            }
            const uid = req.session.userId;
            const tripId = req.params.id;
            let payload =
                typeof row.payload === 'object' && row.payload != null ? { ...row.payload } : {};
            try {
                const sync = await syncTripExpensesToFinance(uid, tripId, payload);
                if (sync.changed) {
                    payload = { ...payload, expenses: sync.expenses };
                    row =
                        (await repo.updateTrip(tripId, { payload })) ?? {
                            ...row,
                            payload
                        };
                }
            } catch (syncErr) {
                console.warn('GET trip finance sync', syncErr?.message ?? syncErr);
            }
            const trip = normalizeTrip(row);
            const timeScenarios = trip.payload?.timeScenarios ?? trip.payload?.time_scenarios ?? [];
            const scenarioSnaps = snapshots(timeScenarios);
            let financeMovements;
            try {
                financeMovements = await listTripFinanceMovements(req.session.userId, req.params.id);
            } catch {
                financeMovements = undefined;
            }
            res.json({
                trip: enrichTripSummary(row),
                scenarioSnapshots: scenarioSnaps,
                scenarioWinnerId: winner(
                    scenarioSnaps,
                    trip.payload?.scenarioCriteria ?? trip.payload?.scenario_criteria ?? []
                ),
                financeMovements
            });
        } catch (e) {
            console.error('GET /api/trips/:id', e);
            res.status(500).json({ error: 'Erro ao carregar viagem' });
        }
    });

    app.get('/api/trips/:id/finance-movements', requireAuth, async (req, res) => {
        try {
            const view = await listTripFinanceMovements(req.session.userId, req.params.id);
            res.json({ movements: view.lines, totals: view.totals });
        } catch (e) {
            if (e.statusCode === 404) return res.status(404).json({ error: e.message });
            console.error('GET /api/trips/:id/finance-movements', e);
            res.status(500).json({ error: 'Erro ao listar movimentos da viagem' });
        }
    });

    app.put('/api/trips/:id', requireAuth, async (req, res) => {
        try {
            const body = req.body ?? {};
            const existing = await repo.getTripForUser(req.session.userId, req.params.id);
            if (!existing) return res.status(404).json({ error: 'Não encontrada' });

            const serverPayload =
                typeof existing.payload === 'object' && existing.payload ? existing.payload : {};
            const mergedPayload =
                body.payload != null ? mergePayload(serverPayload, body.payload) : null;

            let row = await repo.updateTrip(req.params.id, {
                title: body.title,
                starts_on: body.startsOn ?? body.starts_on ?? null,
                ends_on: body.endsOn ?? body.ends_on ?? null,
                status_override: body.statusOverride ?? body.status_override ?? null,
                budget_caps: body.budgetCaps ?? body.budget_caps,
                payload: mergedPayload
            });
            if (!row) return res.status(404).json({ error: 'Não encontrada' });

            const uid = req.session.userId;
            const tripId = req.params.id;
            let payload =
                typeof row.payload === 'object' && row.payload != null ? { ...row.payload } : {};
            const sync = await syncTripExpensesToFinance(uid, tripId, payload);
            if (sync.changed) {
                payload = { ...payload, expenses: sync.expenses };
                row = (await repo.updateTrip(tripId, { payload })) ?? { ...row, payload };
            }

            res.json({
                trip: enrichTripSummary(row),
                financeSyncWarnings: sync.warnings?.length ? sync.warnings : undefined
            });
        } catch (e) {
            console.error('PUT /api/trips/:id', e);
            res.status(500).json({ error: e.message || 'Erro ao salvar viagem' });
        }
    });

    app.get('/api/trips/fx-quotes', requireAuth, async (_req, res) => {
        try {
            const quotes = await fetchTaxFxQuotes(globalThis.fetch);
            res.json(quotes);
        } catch (e) {
            console.error('GET /api/trips/fx-quotes', e);
            res.status(502).json({ error: 'Cotações indisponíveis' });
        }
    });

    app.delete('/api/trips/:id', requireAuth, async (req, res) => {
        try {
            const existing = await repo.getTripForUser(req.session.userId, req.params.id);
            if (!existing) return res.status(404).json({ error: 'Não encontrada' });
            const ok = await repo.deleteTrip(req.params.id);
            if (!ok) return res.status(404).json({ error: 'Não encontrada' });
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE /api/trips/:id', e);
            res.status(500).json({ error: 'Erro ao apagar viagem' });
        }
    });
}
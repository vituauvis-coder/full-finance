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

function mergePayload(serverPayload, clientPayload) {
    if (!clientPayload || typeof clientPayload !== 'object') return serverPayload ?? {};
    const base = serverPayload && typeof serverPayload === 'object' ? serverPayload : {};
    return { ...base, ...clientPayload };
}

export function registerTripsRoutes(app, { requireAuth }) {
    app.get('/api/trips', requireAuth, async (req, res) => {
        try {
            const rows = await repo.listTrips();
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
        const q = String(req.query.q ?? '').trim();
        if (q.length < 2) return res.json({ hits: [] });
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('q', q);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '8');
            const response = await fetch(url, {
                headers: { 'User-Agent': 'MeuMalote/1.0 (viagens)' }
            });
            const data = await response.json();
            const hits = (data ?? []).map((item) => ({
                name: item.display_name?.split(',')[0] ?? item.name ?? q,
                country: item.display_name?.split(',').at(-1)?.trim() ?? '',
                latitude: Number(item.lat),
                longitude: Number(item.lon),
                kind: 'city'
            }));
            res.json({ hits });
        } catch (err) {
            console.error('[geocode]', err);
            res.status(502).json({ error: 'geocode_failed' });
        }
    });

    app.get('/api/trips/:id', requireAuth, async (req, res) => {
        try {
            const row = await repo.getTrip(req.params.id);
            if (!row) return res.status(404).json({ error: 'Não encontrada' });
            const trip = normalizeTrip(row);
            const timeScenarios = trip.payload?.timeScenarios ?? trip.payload?.time_scenarios ?? [];
            const scenarioSnaps = snapshots(timeScenarios);
            res.json({
                trip: enrichTripSummary(row),
                scenarioSnapshots: scenarioSnaps,
                scenarioWinnerId: winner(
                    scenarioSnaps,
                    trip.payload?.scenarioCriteria ?? trip.payload?.scenario_criteria ?? []
                )
            });
        } catch (e) {
            console.error('GET /api/trips/:id', e);
            res.status(500).json({ error: 'Erro ao carregar viagem' });
        }
    });

    app.put('/api/trips/:id', requireAuth, async (req, res) => {
        try {
            const body = req.body ?? {};
            const existing = await repo.getTrip(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Não encontrada' });

            const serverPayload =
                typeof existing.payload === 'object' && existing.payload ? existing.payload : {};
            const mergedPayload =
                body.payload != null ? mergePayload(serverPayload, body.payload) : null;

            const row = await repo.updateTrip(req.params.id, {
                title: body.title,
                starts_on: body.startsOn ?? body.starts_on ?? null,
                ends_on: body.endsOn ?? body.ends_on ?? null,
                status_override: body.statusOverride ?? body.status_override ?? null,
                budget_caps: body.budgetCaps ?? body.budget_caps,
                payload: mergedPayload
            });
            if (!row) return res.status(404).json({ error: 'Não encontrada' });
            res.json({ trip: enrichTripSummary(row) });
        } catch (e) {
            console.error('PUT /api/trips/:id', e);
            res.status(500).json({ error: 'Erro ao salvar viagem' });
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
            const ok = await repo.deleteTrip(req.params.id);
            if (!ok) return res.status(404).json({ error: 'Não encontrada' });
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE /api/trips/:id', e);
            res.status(500).json({ error: 'Erro ao apagar viagem' });
        }
    });
}
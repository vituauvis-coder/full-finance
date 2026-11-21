import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { geocodeSearch, lodgingSearch, type LodgingSearchHit } from '../../api/trips';
import type { TripDestination, TripPayload, TripStay } from '../../types';
import { pickPlaceDisplayName } from '../../utils/place-display';
import { healStayDestinationIds, matchDestinationIdForStay } from './hospedagens-display';
import { HospedagensMap } from './HospedagensMap';
import { HospedagensStayEditor, type HospEditorMode } from './HospedagensStayEditor';
import { HospedagensStayRow } from './HospedagensStayRow';

type Props = {
    tripId: string;
    payload: TripPayload;
    destinations: TripDestination[];
    stays: TripStay[];
    onChangeStays: (update: TripStay[] | ((prev: TripStay[]) => TripStay[])) => void;
    saving?: boolean;
    onFlushSave?: () => Promise<void>;
};

function stayOpensInEdit(stay: TripStay): boolean {
    return !(stay.name ?? '').trim() && !stay.checkInOn && !stay.check_in_on;
}

export function HospedagensBoard({
    tripId,
    payload,
    destinations,
    stays,
    onChangeStays,
    saving,
    onFlushSave
}: Props) {
    const [searchQ, setSearchQ] = useState('');
    const [searching, setSearching] = useState(false);
    const [hits, setHits] = useState<LodgingSearchHit[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [focusStayId, setFocusStayId] = useState<string | null>(() => stays[0]?.id ?? null);
    const [editorMode, setEditorMode] = useState<HospEditorMode>('view');

    const destOptions = useMemo(
        () => destinations.map((d) => ({ id: d.id, label: d.name })),
        [destinations]
    );

    const destLabelById = useMemo(() => new Map(destOptions.map((d) => [d.id, d.label])), [destOptions]);

    const focusStay = stays.find((s) => s.id === focusStayId) ?? null;

    const applyStays = useCallback(
        (update: TripStay[] | ((prev: TripStay[]) => TripStay[])) => {
            onChangeStays(update);
        },
        [onChangeStays]
    );

    const patchStay = useCallback(
        (id: string, partial: Partial<TripStay>) => {
            applyStays((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
        },
        [applyStays]
    );

    useEffect(() => {
        if (focusStayId && stays.some((s) => s.id === focusStayId)) return;
        const next = stays[0]?.id ?? null;
        setFocusStayId(next);
    }, [stays, focusStayId]);

    const stayHealKeyRef = useRef('');
    useEffect(() => {
        const key = `${stays.map((s) => `${s.id}:${s.destinationId ?? ''}:${s.city ?? ''}`).join('|')}#${destinations.map((d) => d.id).join(',')}`;
        if (key === stayHealKeyRef.current) return;
        const healed = healStayDestinationIds(stays, destinations);
        if (!healed) {
            stayHealKeyRef.current = key;
            return;
        }
        stayHealKeyRef.current = `${healed.map((s) => `${s.id}:${s.destinationId ?? ''}:${s.city ?? ''}`).join('|')}#${destinations.map((d) => d.id).join(',')}`;
        applyStays(() => healed);
    }, [stays, destinations, applyStays]);

    useEffect(() => {
        if (!focusStayId) {
            setEditorMode('view');
            return;
        }
        const s = stays.find((x) => x.id === focusStayId);
        if (!s) return;
        setEditorMode(stayOpensInEdit(s) ? 'edit' : 'view');
    }, [focusStayId, stays]);

    const tripCtx = useMemo(() => ({ payload }), [payload]);

    function focusStayRecord(stay: TripStay) {
        setFocusStayId(stay.id);
    }

    async function runLodgingSearch() {
        const q = searchQ.trim();
        if (q.length < 2) return;
        setSearching(true);
        setSearchError(null);
        setHits([]);
        try {
            const principal = destinations.find((d) => d.isPrincipal) ?? destinations[0];
            let lodgingHits: LodgingSearchHit[] = [];
            try {
                const res = await lodgingSearch({
                    q,
                    lat: principal?.latitude,
                    lon: principal?.longitude,
                    radiusKm: 12
                });
                lodgingHits = res.hits ?? [];
            } catch {
                /* fallback geocode */
            }
            if (lodgingHits.length) {
                setHits(lodgingHits);
                return;
            }
            const { hits: geoHits } = await geocodeSearch(q);
            if (!geoHits.length) {
                setSearchError(`Nenhum resultado para “${q}”. Tente cidade + nome do hotel.`);
                return;
            }
            setHits(
                geoHits.map((g) => ({
                    name: g.name,
                    address: g.address ?? g.country,
                    city: g.city ?? g.name,
                    country: g.country,
                    latitude: g.latitude,
                    longitude: g.longitude,
                    source: 'nominatim',
                    kind: g.kind ?? 'place'
                }))
            );
        } catch {
            setSearchError('Busca indisponível. Tente de novo em instantes.');
        } finally {
            setSearching(false);
        }
    }

    function addFromHit(hit: LodgingSearchHit) {
        const destId = matchDestinationIdForStay(
            {
                city: hit.city,
                country: hit.country,
                latitude: hit.latitude,
                longitude: hit.longitude,
                name: hit.name
            },
            destinations
        );
        const next: TripStay = {
            id: crypto.randomUUID(),
            name: hit.name,
            address: hit.address,
            city: hit.city,
            country: hit.country,
            latitude: hit.latitude,
            longitude: hit.longitude,
            destinationId: destId,
            amount: 0,
            source: (hit.source as TripStay['source']) ?? 'search',
            osmId: hit.osmId,
            osmType: hit.osmType,
            kind: hit.kind
        };
        applyStays((prev) => [...prev, next]);
        setFocusStayId(next.id);
        setEditorMode('edit');
        setHits([]);
        setSearchQ('');
    }

    function addBlank() {
        const next: TripStay = {
            id: crypto.randomUUID(),
            amount: 0,
            name: '',
            destinationId: null,
            source: 'manual'
        };
        applyStays((prev) => [...prev, next]);
        setFocusStayId(next.id);
        setEditorMode('edit');
    }

    function applyMapPin(lat: number, lng: number) {
        if (!focusStayId || !stays.some((s) => s.id === focusStayId)) {
            const next: TripStay = {
                id: crypto.randomUUID(),
                amount: 0,
                name: '',
                latitude: lat,
                longitude: lng,
                destinationId: matchDestinationIdForStay(
                    { latitude: lat, longitude: lng },
                    destinations
                ),
                source: 'manual'
            };
            applyStays((prev) => [...prev, next]);
            setFocusStayId(next.id);
            setEditorMode('edit');
            return;
        }
        patchStay(focusStayId, { latitude: lat, longitude: lng });
        setEditorMode('edit');
    }

    function removeFocus() {
        if (!focusStayId) return;
        applyStays((prev) => prev.filter((s) => s.id !== focusStayId));
    }

    const mapTitle = focusStay
        ? pickPlaceDisplayName({ name: focusStay.name, countryName: focusStay.country ?? focusStay.city }) ||
          'Hospedagem'
        : 'Destinos e aeroportos';

    return (
        <section className="hosp-workspace" aria-label="Hospedagens">
            <aside className="hosp-workspace__rail" aria-label="Lista">
                <header className="hosp-rail__head">
                    <h2>Registros</h2>
                    <button type="button" className="hosp-board__cta" onClick={addBlank}>
                        <MaterialIcon name="add" variant="app" opticalSize={18} />
                        Nova
                    </button>
                </header>

                <div className="hosp-search hosp-search--glass">
                    <span className="hosp-search__icon" aria-hidden="true">
                        <MaterialIcon name="search" variant="app" opticalSize={20} />
                    </span>
                    <input
                        className="hosp-search__input"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void runLodgingSearch()}
                        placeholder="Hotel ou endereço"
                        aria-label="Buscar hospedagem"
                    />
                    <button
                        type="button"
                        className="hosp-board__cta hosp-board__cta--dense"
                        disabled={searching || searchQ.trim().length < 2}
                        onClick={() => void runLodgingSearch()}
                    >
                        {searching ? '…' : 'Buscar'}
                    </button>
                </div>

                {searchError ? (
                    <p role="alert" className="viagens-toast viagens-toast--error hosp-rail__toast">
                        {searchError}
                    </p>
                ) : null}

                {hits.length > 0 ? (
                    <ul className="hosp-search__hits" role="listbox" aria-label="Resultados da busca">
                        {hits.map((hit, i) => (
                            <li key={`${hit.osmId || 'hit'}-${i}`}>
                                <button type="button" className="hosp-search__hit" onClick={() => addFromHit(hit)}>
                                    <span className="hosp-search__hit-icon" aria-hidden="true">
                                        <MaterialIcon name="apartment" variant="app" opticalSize={18} />
                                    </span>
                                    <span className="hosp-search__hit-body">
                                        <span className="hosp-search__hit-main">
                                            <strong>{hit.name}</strong>
                                            {hit.stars ? (
                                                <span className="hosp-search__stars">{hit.stars}★</span>
                                            ) : null}
                                        </span>
                                        <span className="hosp-search__hit-sub">
                                            {[hit.city, hit.country, hit.address].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}

                <p className="hosp-list__kicker">
                    {stays.length} {stays.length === 1 ? 'registro' : 'registros'}
                </p>
                <div className="hosp-rail__list">
                    {stays.length === 0 ? (
                        <div className="hosp-list__empty">
                            <MaterialIcon name="apartment" variant="app" opticalSize={28} />
                            <p>Nenhum registro</p>
                            <p className="hosp-list__empty-hint">Busque, crie ou clique no mapa.</p>
                        </div>
                    ) : (
                        stays.map((stay) => (
                            <HospedagensStayRow
                                key={stay.id}
                                stay={stay}
                                selected={focusStayId === stay.id}
                                destLabel={destLabelById.get(stay.destinationId ?? '') ?? ''}
                                onSelect={() => focusStayRecord(stay)}
                            />
                        ))
                    )}
                </div>

                <p className="hosp-rail__foot">
                    Integra com o{' '}
                    <Link to={`/viagens/${tripId}?modulo=orcamento`} className="hosp-board__link">
                        orçamento
                    </Link>
                    .
                </p>
            </aside>

            <div className="hosp-workspace__main">
                {focusStay ? (
                    <HospedagensStayEditor
                        key={focusStay.id}
                        stay={focusStay}
                        tripCtx={tripCtx}
                        destOptions={destOptions}
                        mode={editorMode}
                        saving={saving}
                        onPatch={(p) => patchStay(focusStay.id, p)}
                        onRemove={removeFocus}
                        onEdit={() => setEditorMode('edit')}
                        onCancel={() => setEditorMode('view')}
                        onSave={async () => {
                            if (onFlushSave) await onFlushSave();
                            setEditorMode('view');
                        }}
                    />
                ) : (
                    <div className="hosp-workspace__placeholder" role="status">
                        <MaterialIcon name="touch_app" variant="app" opticalSize={36} />
                        <p>Selecione um registro ou crie uma nova hospedagem.</p>
                        <button type="button" className="hosp-board__cta" onClick={addBlank}>
                            <MaterialIcon name="add" variant="app" opticalSize={18} />
                            Nova hospedagem
                        </button>
                    </div>
                )}
            </div>

            <aside className="hosp-workspace__map" aria-label="Mapa">
                <header className="hosp-board__map-head">
                    <div>
                        <p className="hosp-board__map-kicker">Mapa</p>
                        <p className="hosp-board__map-title">{mapTitle}</p>
                    </div>
                    <Link to={`/viagens/${tripId}/transporte/voos`} className="hosp-board__link">
                        Voos
                    </Link>
                </header>
                {focusStay && editorMode !== 'edit' ? (
                    <p className="hosp-map-hint">Modo ficha: use <strong>Editar</strong> para clicar no mapa.</p>
                ) : null}
                <HospedagensMap
                    payload={payload}
                    destinations={destinations}
                    stays={stays}
                    focusStayId={focusStayId}
                    onTapCoord={editorMode === 'edit' ? applyMapPin : undefined}
                />
            </aside>
        </section>
    );
}
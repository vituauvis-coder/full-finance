import { useCallback, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { geocodeSearch, lodgingSearch, type LodgingSearchHit } from '../../api/trips';
import type { TripDestination, TripPayload, TripStay } from '../../types';
import { matchDestinationIdForStay } from './hospedagens-display';
import { HospedagemEditorModal } from './HospedagemEditorModal';
import { HospedagensLodgingList } from './HospedagensLodgingList';

type Props = {
    payload: TripPayload;
    destinations: TripDestination[];
    stays: TripStay[];
    focusStayId?: string | null;
    onFocusStayChange?: (id: string | null) => void;
    onChangeStays: (update: TripStay[] | ((prev: TripStay[]) => TripStay[])) => void;
};

export function HospedagensPanel({
    payload,
    destinations,
    stays,
    focusStayId,
    onFocusStayChange,
    onChangeStays
}: Props) {
    const [searchQ, setSearchQ] = useState('');
    const [searching, setSearching] = useState(false);
    const [hits, setHits] = useState<LodgingSearchHit[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [editingStayId, setEditingStayId] = useState<string | null>(null);

    const destOptions = useMemo(
        () => destinations.map((d) => ({ id: d.id, label: d.name })),
        [destinations]
    );
    const destLabelById = useMemo(() => new Map(destOptions.map((d) => [d.id, d.label])), [destOptions]);

    const editingStay = stays.find((s) => s.id === editingStayId) ?? null;
    const listFocusId = editingStayId ?? focusStayId ?? null;

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

    function setFocus(id: string | null) {
        onFocusStayChange?.(id);
    }

    function openStay(stay: TripStay) {
        setEditingStayId(stay.id);
        setFocus(stay.id);
    }

    function closeEditor() {
        setEditingStayId(null);
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
                /* fallback */
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
        openStay(next);
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
        openStay(next);
    }

    function removeStay(id: string) {
        applyStays((prev) => prev.filter((s) => s.id !== id));
        if (editingStayId === id) setEditingStayId(null);
        if (focusStayId === id) setFocus(null);
    }

    return (
        <section className="voos-home__block hosp-board" aria-label="Suas hospedagens">
            <header className="voos-board__head hosp-board__head">
                <div>
                    <p className="pontos-kicker">Reservas</p>
                    <h2>Suas hospedagens</h2>
                </div>
                <button type="button" className="voos-add-segment" onClick={addBlank}>
                    + Adicionar
                </button>
            </header>

            <div className="hosp-search hosp-search--glass hosp-board__search">
                <span className="hosp-search__icon" aria-hidden="true">
                    <MaterialIcon name="search" variant="app" opticalSize={18} />
                </span>
                <input
                    className="hosp-search__input"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void runLodgingSearch()}
                    placeholder="Buscar hotel ou endereço"
                    aria-label="Buscar hospedagem"
                />
                <button
                    type="button"
                    className="voos-add-segment hosp-search__btn"
                    disabled={searching || searchQ.trim().length < 2}
                    onClick={() => void runLodgingSearch()}
                >
                    {searching ? '…' : 'Buscar'}
                </button>
            </div>

            {searchError ? (
                <p role="alert" className="viagens-toast viagens-toast--error">
                    {searchError}
                </p>
            ) : null}

            {hits.length > 0 ? (
                <ul className="hosp-search__hits hosp-board__hits" role="listbox" aria-label="Resultados da busca">
                    {hits.map((hit, i) => (
                        <li key={`${hit.osmId || 'hit'}-${i}`}>
                            <button type="button" className="hosp-search__hit" onClick={() => addFromHit(hit)}>
                                <span className="hosp-search__hit-icon" aria-hidden="true">
                                    <MaterialIcon name="apartment" variant="app" opticalSize={16} />
                                </span>
                                <span className="hosp-search__hit-body">
                                    <strong>{hit.name}</strong>
                                    <span className="hosp-search__hit-sub">
                                        {[hit.city, hit.country].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}

            {stays.length === 0 ? (
                <div className="voos-empty voos-empty--board">
                    <span className="voos-empty__icon" aria-hidden>
                        <MaterialIcon name="apartment" variant="app" opticalSize={28} />
                    </span>
                    <p>Nenhuma hospedagem cadastrada.</p>
                </div>
            ) : (
                <HospedagensLodgingList
                    stays={stays}
                    destinations={destinations}
                    destLabelById={destLabelById}
                    focusStayId={listFocusId}
                    onFocus={setFocus}
                    onEdit={openStay}
                    onDelete={removeStay}
                    onTogglePaid={(id, paid) => patchStay(id, { paid })}
                />
            )}

            <HospedagemEditorModal
                open={!!editingStay}
                stay={editingStay}
                destOptions={destOptions}
                onClose={closeEditor}
                onChange={(next) => {
                    if (!editingStayId) return;
                    applyStays((prev) => prev.map((s) => (s.id === editingStayId ? next : s)));
                }}
                onDelete={() => {
                    if (!editingStayId) return;
                    if (window.confirm('Apagar esta hospedagem?')) removeStay(editingStayId);
                }}
            />
        </section>
    );
}
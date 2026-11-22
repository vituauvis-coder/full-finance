import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { geocodeSearch } from '../api/trips';
import type {
    GeocodeHit,
    Trip,
    TripCheckItem,
    TripDestination,
    TripDocItem,
    TripExpense,
    TripLeg,
    TripFlightSegment,
    TripPayload,
    TripStay
} from '../types';
import { routeStops } from '@motor/viagens/trip-places.js';
import { budgets } from '@motor/viagens/trips-engine.js';
import { ViagemMiniMap } from './ViagemMiniMap';
import { tripFlightSegments } from '@motor/viagens/flight-simulation.js';
import { ViagemSecaoCard } from './ViagemSecaoCard';
import { ViagemModuloPanel, ViagemModulos, type FichaModuloId } from './ViagemModulos';
import { TripIdViagemModal } from './TripIdViagemModal';
import { TripFichaTopRow } from './TripFichaTopRow';
import { TripFeedSection } from './feed/TripFeedSection';
import { TripOrcamentoPanel } from './orcamento/TripOrcamentoPanel';
import { orcamentoCategoryLabel } from './orcamento/orcamento-model';
import '../styles/orcamento-workspace.css';
import { formatBRL } from '../utils/map-utils';
import '../styles/viagens-ficha-form.css';
import '../styles/viagens-ficha-cadastro.css';

const BUILTIN_CATS = ['hospedagem', 'comida', 'transporte', 'passeios', 'extras'] as const;

const CAT_LABELS: Record<(typeof BUILTIN_CATS)[number], string> = {
    hospedagem: 'Hospedagem',
    comida: 'Comida',
    transporte: 'Transportes',
    passeios: 'Passeios',
    extras: 'Extras'
};

function EssentialCadastroShell({ isCadastro, children }: { isCadastro: boolean; children: ReactNode }) {
    if (isCadastro) {
        return (
            <article className="viagens-panel viagens-panel--cadastro" aria-label="Datas e destinos">
                <header className="viagens-panel__head">
                    <h3 className="viagens-panel__title">Essencial</h3>
                    <span className="viagens-muted viagens-panel__hint">Nome, datas e pelo menos um destino</span>
                </header>
                {children}
            </article>
        );
    }
    return <>{children}</>;
}

export type TripDraft = {
    title: string;
    startsOn: string;
    endsOn: string;
    statusOverride: string;
    budgetCaps: Record<string, number>;
    payload: TripPayload;
};

type Props = {
    trip: Trip;
    onChange: (draft: TripDraft) => void;
    scenarioWinnerId?: string | null;
    /** Rascunho controlado pelo pai (ficha salva ou /viagens/nova). */
    draft?: TripDraft;
    /** Layout de cadastro em /viagens/nova — não usar na ficha de viagem salva. */
    cadastro?: boolean;
    /** Globo fullscreen renderizado fora da ficha (ViagemNovaPage). */
    externalGlobe?: boolean;
    modulo?: FichaModuloId | null;
    onModuloChange?: (id: FichaModuloId | null) => void;
    scenarioCount?: number;
    onOpenSimulador?: () => void;
    onFlushSave?: () => void | Promise<void>;
    expenseAuthors?: Record<string, { id: string; name: string }>;
};

function emptyPayload(): TripPayload {
    return {
        destinations: [],
        expenses: [],
        stays: [],
        itinerary: [],
        legs: [],
        documents: [],
        checks: [],
        flight_segments: [],
        time_scenarios: [],
        budget_custom_categories: []
    };
}

function normalizeBudgetCaps(raw: Record<string, unknown> | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) out[key] = n;
    }
    return out;
}

export function tripToDraft(trip: Trip): TripDraft {
    const rawCaps =
        trip.budgetCaps ??
        (trip as Trip & { budget_caps?: Record<string, unknown> }).budget_caps;
    return {
        title: trip.title,
        startsOn: trip.startsOn ?? '',
        endsOn: trip.endsOn ?? '',
        statusOverride: trip.statusOverride ?? '',
        budgetCaps: normalizeBudgetCaps(rawCaps as Record<string, unknown> | undefined),
        payload: { ...emptyPayload(), ...trip.payload }
    };
}

export function ViagemFicha({
    trip,
    onChange,
    draft: controlledDraft,
    cadastro = false,
    externalGlobe = false,
    modulo,
    onModuloChange,
    scenarioCount = 0,
    onOpenSimulador,
    onFlushSave,
    expenseAuthors
}: Props) {
    const [internalDraft, setInternalDraft] = useState(() => tripToDraft(trip));
    const draft = controlledDraft ?? internalDraft;
    const [geoQ, setGeoQ] = useState('');
    const [geoHits, setGeoHits] = useState<GeocodeHit[]>([]);
    const [internalModulo, setInternalModulo] = useState<FichaModuloId | null>(null);
    const [tripIdModalOpen, setTripIdModalOpen] = useState(false);
    const fichaModulo = onModuloChange ? (modulo ?? null) : internalModulo;
    const setFichaModulo = onModuloChange ?? setInternalModulo;

    const patch = useCallback(
        (fn: (d: TripDraft) => TripDraft) => {
            if (controlledDraft) {
                onChange(fn(controlledDraft));
                return;
            }
            setInternalDraft((prev) => {
                const next = fn(prev);
                onChange(next);
                return next;
            });
        },
        [onChange, controlledDraft]
    );

    const destinations = draft.payload.destinations ?? [];

    async function runGeocode() {
        if (geoQ.trim().length < 2) return;
        const { hits } = await geocodeSearch(geoQ.trim());
        setGeoHits(hits);
    }

    function addDestination(hit: GeocodeHit) {
        const dest: TripDestination = {
            id: crypto.randomUUID(),
            name: hit.name,
            country: hit.country,
            latitude: hit.latitude,
            longitude: hit.longitude
        };
        patch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                destinations: [...(d.payload.destinations ?? []), dest]
            }
        }));
        setGeoQ('');
        setGeoHits([]);
    }

    const destOptions = useMemo(
        () => destinations.map((d) => ({ id: d.id, label: d.name })),
        [destinations]
    );

    const routeIds = routeStops(destinations);

    function dropPin(lat: number, lng: number) {
        const dest: TripDestination = {
            id: crypto.randomUUID(),
            name: 'Novo lugar',
            latitude: lat,
            longitude: lng
        };
        patch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                destinations: [...(d.payload.destinations ?? []), dest]
            }
        }));
    }

    const flightSegments = tripFlightSegments(draft.payload) as TripFlightSegment[];
    const isCadastro = cadastro;

    const periodoGridCadastro = (
        <div className="viagens-form-grid viagens-form-grid--2 viagens-form-grid--cadastro-datas">
            <div className="viagens-form-field">
                <label htmlFor="trip-start-cad">Início</label>
                <input
                    id="trip-start-cad"
                    type="date"
                    className="viagens-field"
                    value={draft.startsOn}
                    onChange={(e) => patch((d) => ({ ...d, startsOn: e.target.value }))}
                />
            </div>
            <div className="viagens-form-field">
                <label htmlFor="trip-end-cad">Fim</label>
                <input
                    id="trip-end-cad"
                    type="date"
                    className="viagens-field"
                    value={draft.endsOn}
                    onChange={(e) => patch((d) => ({ ...d, endsOn: e.target.value }))}
                />
            </div>
        </div>
    );

    const goal = Number(draft.payload.tripGoal ?? draft.payload.trip_goal ?? 0) || 0;
    const piggy = Number(draft.payload.piggyBank ?? draft.payload.piggy_bank ?? 0) || 0;
    const budgetRows = useMemo(
        () => budgets({ payload: draft.payload, budgetCaps: draft.budgetCaps }),
        [draft.payload, draft.budgetCaps]
    );

    const orcamentoCore = (
        <>
            <div className="viagens-form-grid viagens-form-grid--2">
                <div className="viagens-form-field">
                    <label htmlFor="trip-goal">Meta (R$)</label>
                    <input
                        id="trip-goal"
                        type="number"
                        className="viagens-field"
                        min={0}
                        value={goal || ''}
                        onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            patch((d) => ({
                                ...d,
                                payload: { ...d.payload, tripGoal: v, trip_goal: v }
                            }));
                        }}
                    />
                </div>
                <div className="viagens-form-field">
                    <label htmlFor="trip-piggy">Cofrinho (R$)</label>
                    <input
                        id="trip-piggy"
                        type="number"
                        className="viagens-field"
                        min={0}
                        value={piggy || ''}
                        onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            patch((d) => ({
                                ...d,
                                payload: { ...d.payload, piggyBank: v, piggy_bank: v }
                            }));
                        }}
                    />
                </div>
            </div>
            <p className="viagens-form-subhead">Tetos por categoria</p>
            <div className="viagens-form-stack">
                {budgetRows.map((row) => {
                    const cat = row.category as (typeof BUILTIN_CATS)[number];
                    const label = orcamentoCategoryLabel(draft.payload, row.category, CAT_LABELS[cat] ?? row.category);
                    const cap = row.cap;
                    const used = row.spent;
                    const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                    return (
                        <div key={row.category} className="viagens-form-field">
                            <label htmlFor={`cap-${row.category}`}>Teto · {label}</label>
                            <input
                                id={`cap-${row.category}`}
                                type="number"
                                className="viagens-field"
                                min={0}
                                value={draft.budgetCaps[row.category] ?? ''}
                                onChange={(e) =>
                                    patch((d) => ({
                                        ...d,
                                        budgetCaps: { ...d.budgetCaps, [row.category]: Number(e.target.value) || 0 }
                                    }))
                                }
                            />
                            <span className="viagens-muted">
                                {formatBRL(used)} / {formatBRL(cap)}
                            </span>
                            {cap > 0 ? (
                                <div className="viagens-cap-bar">
                                    <div className="viagens-cap-bar__fill" style={{ width: `${pct}%` }} />
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <p className="viagens-form-subhead">Lançamentos</p>
            <ExpenseBlock
                expenses={draft.payload.expenses ?? []}
                destOptions={destOptions}
                onChange={(expenses) => patch((d) => ({ ...d, payload: { ...d.payload, expenses } }))}
            />
        </>
    );

    const destinosCore = (
        <>
                {isCadastro ? (
                    <>
                        <p className="viagens-form-subhead">Quando</p>
                        {periodoGridCadastro}
                        <hr className="viagens-form-divider" />
                        <p className="viagens-form-subhead">Para onde</p>
                    </>
                ) : null}
                <div className={isCadastro && !externalGlobe ? 'viagens-cadastro-destinos-layout' : undefined}>
                    <div className={isCadastro && !externalGlobe ? 'viagens-cadastro-destinos-main' : undefined}>
                <div className="viagens-form-toolbar">
                    <input
                        id="geo-search"
                        className="viagens-field"
                        value={geoQ}
                        onChange={(e) => setGeoQ(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void runGeocode()}
                        placeholder="Cidade, país ou aeroporto"
                        aria-describedby="geo-hint"
                    />
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => void runGeocode()}>
                        Buscar
                    </button>
                </div>
                <p id="geo-hint" className="viagens-form-hint">
                    {isCadastro && externalGlobe
                        ? 'Busque abaixo ou clique no globo ao lado para adicionar um destino. Saída: Recife.'
                        : isCadastro
                          ? 'Busque e adicione destinos. Saída: Recife. Toque no mapa para pin manual.'
                          : 'Recife é a saída. Clique no mini-mapa para soltar um pin.'}
                </p>
                {geoHits.length > 0 ? (
                    <ul className="viagens-form-hits">
                        {geoHits.map((h, i) => (
                            <li key={`${h.name}-${i}`}>
                                <button type="button" onClick={() => addDestination(h)}>
                                    + {h.name}
                                    {h.country ? ` · ${h.country}` : ''}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {isCadastro && routeIds.length === 0 ? (
                    <p className="viagens-form-empty">
                        {externalGlobe
                            ? 'Nenhum destino ainda — use a busca ou clique no globo.'
                            : 'Nenhum destino ainda — use a busca ou o mapa ao lado.'}
                    </p>
                ) : null}
                {routeIds.length > 0 ? (
                    <>
                        <div className="viagens-chip-row">
                            {routeIds.map((id, index) => {
                                const d = destinations.find((x) => x.id === id);
                                if (!d) return null;
                                return (
                                    <span
                                        key={d.id}
                                        className={`viagens-chip ${d.isPrincipal ? 'viagens-chip--principal' : ''}`}
                                    >
                                        <span>{index + 1}</span>
                                        <button
                                            type="button"
                                            aria-label="Destino principal"
                                            onClick={() =>
                                                patch((st) => ({
                                                    ...st,
                                                    payload: {
                                                        ...st.payload,
                                                        destinations: (st.payload.destinations ?? []).map((x) => ({
                                                            ...x,
                                                            isPrincipal: x.id === d.id
                                                        }))
                                                    }
                                                }))
                                            }
                                        >
                                            {d.isPrincipal ? '★' : '☆'}
                                        </button>
                                        <input
                                            className="viagens-field"
                                            value={d.name}
                                            onChange={(e) => updateDest(patch, d.id, { name: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            aria-label={`Remover ${d.name}`}
                                            onClick={() =>
                                                patch((st) => ({
                                                    ...st,
                                                    payload: {
                                                        ...st.payload,
                                                        destinations: (st.payload.destinations ?? []).filter(
                                                            (x) => x.id !== d.id
                                                        )
                                                    }
                                                }))
                                            }
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                        {!(isCadastro && externalGlobe) ? (
                        <div className="viagens-form-dest-list">
                            {routeIds.map((id) => {
                                const d = destinations.find((x) => x.id === id);
                                if (!d) return null;
                                return (
                                    <div key={`fields-${d.id}`} className="viagens-form-dest">
                                        <p className="viagens-form-dest__name">{d.name}</p>
                                        <div className="viagens-form-field">
                                            <label htmlFor={`dest-in-${d.id}`}>Chegada</label>
                                            <input
                                                id={`dest-in-${d.id}`}
                                                type="date"
                                                className="viagens-field"
                                                value={d.arrivedOn ?? ''}
                                                onChange={(e) =>
                                                    updateDest(patch, d.id, { arrivedOn: e.target.value || null })
                                                }
                                            />
                                        </div>
                                        <div className="viagens-form-field">
                                            <label htmlFor={`dest-out-${d.id}`}>Saída</label>
                                            <input
                                                id={`dest-out-${d.id}`}
                                                type="date"
                                                className="viagens-field"
                                                value={d.departedOn ?? ''}
                                                onChange={(e) =>
                                                    updateDest(patch, d.id, { departedOn: e.target.value || null })
                                                }
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        ) : null}
                    </>
                ) : null}
                    </div>
                    {!(isCadastro && externalGlobe) ? (
                        <div
                            className={
                                isCadastro && !externalGlobe
                                    ? 'viagens-cadastro-destinos-map viagens-form-map'
                                    : 'viagens-form-map'
                            }
                        >
                            <ViagemMiniMap
                                destinations={destinations}
                                trip={{ ...trip, payload: draft.payload }}
                                status={trip.effectiveStatus}
                                onTapCoord={dropPin}
                            />
                        </div>
                    ) : null}
                </div>
                {!isCadastro && (draft.payload.itinerary ?? []).length > 0 ? (
                    <>
                        <p className="viagens-form-subhead">Roteiro</p>
                        <div className="viagens-form-itinerary">
                            {(draft.payload.itinerary ?? []).map((day) => (
                                <span key={day.id} className="viagens-form-itinerary-item">
                                    {day.dayKey ?? day.day_key} · {(day.items ?? []).length} itens
                                </span>
                            ))}
                        </div>
                    </>
                ) : null}
                {!isCadastro ? (
                    <div className="viagens-form-actions">
                        <button
                            type="button"
                            className="viagens-btn viagens-btn--ghost"
                            onClick={() =>
                                syncItinerary(patch, draft.startsOn, draft.endsOn, draft.payload.itinerary ?? [])
                            }
                        >
                            Atualizar dias do roteiro
                        </button>
                    </div>
                ) : null}
        </>
    );

    const hospedagensCore = (
        <>
            <p className="viagens-form-subhead">Hospedagens</p>
            <StayBlock
                stays={draft.payload.stays ?? []}
                destOptions={destOptions}
                onChange={(stays) => patch((d) => ({ ...d, payload: { ...d.payload, stays } }))}
            />
            <p className="viagens-form-subhead">Trechos terrestres</p>
            <LegBlock
                legs={draft.payload.legs ?? []}
                destOptions={destOptions}
                onChange={(legs) => patch((d) => ({ ...d, payload: { ...d.payload, legs } }))}
            />
        </>
    );

    return (
        <>
            {!isCadastro && fichaModulo == null ? (
                <div className="viagens-ficha-home">
                    <ViagemModulos
                        tripId={trip.id}
                        onOpen={setFichaModulo}
                        onOpenTripId={() => setTripIdModalOpen(true)}
                    />
                    <TripFichaTopRow
                        trip={trip}
                        draft={draft}
                        onPatch={patch}
                        scenarioCount={scenarioCount}
                        onOpenSimulador={onOpenSimulador}
                    />
                    <TripFeedSection trip={trip} draft={draft} />
                </div>
            ) : null}

            {isCadastro ? (
                <div className="viagens-ficha-cadastro viagens-ficha-accordion viagens-ficha__sections">
                    <EssentialCadastroShell isCadastro>{destinosCore}</EssentialCadastroShell>
                    <ViagemSecaoCard title="Opcional · orçamento e logística" seal="ouro" defaultOpen={false}>
                        {orcamentoCore}
                        <p className="viagens-form-subhead">Transportes</p>
                        <div className="viagens-form-stack">
                            {flightSegments.map((seg) => (
                                <div key={seg.id} className="viagens-form-check-row">
                                    <span>{seg.title ?? 'Trecho'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="viagens-form-actions">
                            <button
                                type="button"
                                className="viagens-btn viagens-btn--ghost"
                                onClick={() =>
                                    patch((d) => ({
                                        ...d,
                                        payload: {
                                            ...d.payload,
                                            flight_segments: [
                                                ...flightSegments,
                                                { id: crypto.randomUUID(), title: 'Novo trecho', simulations: [] }
                                            ]
                                        }
                                    }))
                                }
                            >
                                + Trecho
                            </button>
                        </div>
                        {hospedagensCore}
                    </ViagemSecaoCard>
                    <ViagemSecaoCard title="Opcional · documentos" seal="oceano" defaultOpen={false}>
                        <p className="viagens-muted">Na ficha salva, use o ícone de documentos no checklist.</p>
                        <ChecklistBlock
                            items={draft.payload.documents ?? []}
                            onChange={(documents) => patch((d) => ({ ...d, payload: { ...d.payload, documents } }))}
                            addLabel="Documento"
                        />
                    </ViagemSecaoCard>
                </div>
            ) : fichaModulo === 'orcamento' ? (
                <TripOrcamentoPanel
                    trip={trip}
                    draft={draft}
                    onPatch={patch}
                    onFlushSave={onFlushSave}
                    expenseAuthors={expenseAuthors}
                />
            ) : fichaModulo ? (
                <ViagemModuloPanel modulo={fichaModulo}>
                    {fichaModulo === 'roteiros' ? destinosCore : null}
                </ViagemModuloPanel>
            ) : null}
            <TripIdViagemModal
                open={tripIdModalOpen}
                trip={trip}
                draft={draft}
                onClose={() => setTripIdModalOpen(false)}
                onPatch={patch}
            />
        </>
    );
}

function updateDest(
    patch: (fn: (d: TripDraft) => TripDraft) => void,
    id: string,
    partial: Partial<TripDestination>
) {
    patch((d) => ({
        ...d,
        payload: {
            ...d.payload,
            destinations: (d.payload.destinations ?? []).map((x) => (x.id === id ? { ...x, ...partial } : x))
        }
    }));
}

function syncItinerary(
    patch: (fn: (d: TripDraft) => TripDraft) => void,
    startsOn: string,
    endsOn: string,
    existing: TripPayload['itinerary']
) {
    if (!startsOn || !endsOn) return;
    const start = new Date(`${startsOn}T12:00:00`);
    const end = new Date(`${endsOn}T12:00:00`);
    if (start > end) return;
    const days: NonNullable<TripPayload['itinerary']> = [];
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 90) {
        const key = cursor.toISOString().slice(0, 10);
        const match = (existing ?? []).find((d) => d.dayKey === key || d.day_key === key);
        days.push(match ?? { id: crypto.randomUUID(), dayKey: key, items: [] });
        cursor = new Date(cursor.getTime() + 86400000);
        guard += 1;
    }
    patch((d) => ({ ...d, payload: { ...d.payload, itinerary: days } }));
}

function ExpenseBlock({
    expenses,
    destOptions,
    onChange
}: {
    expenses: TripExpense[];
    destOptions: { id: string; label: string }[];
    onChange: (e: TripExpense[]) => void;
}) {
    return (
        <>
            {expenses.map((ex) => (
                <div key={ex.id} className="viagens-form-repeat">
                    <input
                        value={ex.description ?? ''}
                        placeholder="Descrição"
                        onChange={(e) =>
                            onChange(expenses.map((x) => (x.id === ex.id ? { ...x, description: e.target.value } : x)))
                        }
                    />
                    <input
                        type="number"
                        value={ex.amount ?? ''}
                        onChange={(e) =>
                            onChange(
                                expenses.map((x) =>
                                    x.id === ex.id ? { ...x, amount: Number(e.target.value) || 0 } : x
                                )
                            )
                        }
                    />
                    <select
                        value={ex.category ?? 'extras'}
                        onChange={(e) =>
                            onChange(expenses.map((x) => (x.id === ex.id ? { ...x, category: e.target.value } : x)))
                        }
                    >
                        {BUILTIN_CATS.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                    <select
                        value={ex.destinationId ?? ''}
                        onChange={(e) =>
                            onChange(
                                expenses.map((x) =>
                                    x.id === ex.id ? { ...x, destinationId: e.target.value || null } : x
                                )
                            )
                        }
                    >
                        <option value="">Sem destino</option>
                        {destOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => onChange(expenses.filter((x) => x.id !== ex.id))}>
                        ×
                    </button>
                </div>
            ))}
            <div className="viagens-form-actions">
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost"
                    onClick={() =>
                        onChange([
                            ...expenses,
                            { id: crypto.randomUUID(), amount: 0, category: 'extras', description: '', spentOn: '' }
                        ])
                    }
                >
                    + Lançamento
                </button>
            </div>
        </>
    );
}

function StayBlock({
    stays,
    destOptions,
    onChange
}: {
    stays: TripStay[];
    destOptions: { id: string; label: string }[];
    onChange: (s: TripStay[]) => void;
}) {
    return (
        <>
            {stays.map((st) => (
                <div key={st.id} className="viagens-form-repeat">
                    <input
                        value={st.name ?? ''}
                        placeholder="Hospedagem"
                        onChange={(e) =>
                            onChange(stays.map((x) => (x.id === st.id ? { ...x, name: e.target.value } : x)))
                        }
                    />
                    <input
                        type="number"
                        value={st.amount ?? ''}
                        onChange={(e) =>
                            onChange(stays.map((x) => (x.id === st.id ? { ...x, amount: Number(e.target.value) } : x)))
                        }
                    />
                    <select
                        value={st.destinationId ?? ''}
                        onChange={(e) =>
                            onChange(
                                stays.map((x) => (x.id === st.id ? { ...x, destinationId: e.target.value || null } : x))
                            )
                        }
                    >
                        <option value="">Destino</option>
                        {destOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => onChange(stays.filter((x) => x.id !== st.id))}>
                        ×
                    </button>
                </div>
            ))}
            <div className="viagens-form-actions">
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost"
                    onClick={() => onChange([...stays, { id: crypto.randomUUID(), amount: 0, name: '' }])}
                >
                    + Hospedagem
                </button>
            </div>
        </>
    );
}

function LegBlock({
    legs,
    destOptions,
    onChange
}: {
    legs: TripLeg[];
    destOptions: { id: string; label: string }[];
    onChange: (l: TripLeg[]) => void;
}) {
    return (
        <>
            {legs.map((leg) => (
                <div key={leg.id} className="viagens-form-repeat viagens-form-leg">
                    <input
                        value={leg.fromName ?? ''}
                        placeholder="De"
                        onChange={(e) =>
                            onChange(legs.map((x) => (x.id === leg.id ? { ...x, fromName: e.target.value } : x)))
                        }
                    />
                    <input
                        value={leg.toName ?? ''}
                        placeholder="Para"
                        onChange={(e) =>
                            onChange(legs.map((x) => (x.id === leg.id ? { ...x, toName: e.target.value } : x)))
                        }
                    />
                    <input
                        type="number"
                        value={leg.amount ?? ''}
                        onChange={(e) =>
                            onChange(legs.map((x) => (x.id === leg.id ? { ...x, amount: Number(e.target.value) } : x)))
                        }
                    />
                    <select
                        value={leg.tripDestinationId ?? ''}
                        onChange={(e) =>
                            onChange(
                                legs.map((x) =>
                                    x.id === leg.id ? { ...x, tripDestinationId: e.target.value || null } : x
                                )
                            )
                        }
                    >
                        <option value="">Destino</option>
                        {destOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => onChange(legs.filter((x) => x.id !== leg.id))}>
                        ×
                    </button>
                </div>
            ))}
            <div className="viagens-form-actions">
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost"
                    onClick={() => onChange([...legs, { id: crypto.randomUUID(), amount: 0 }])}
                >
                    + Trecho terrestre
                </button>
            </div>
        </>
    );
}

function ChecklistBlock({
    items,
    onChange,
    addLabel
}: {
    items: TripDocItem[] | TripCheckItem[];
    onChange: (items: TripDocItem[] | TripCheckItem[]) => void;
    addLabel: string;
}) {
    return (
        <>
            {items.map((it) => (
                <div key={it.id} className="viagens-form-check-row">
                    <input
                        type="checkbox"
                        checked={!!it.done}
                        onChange={(e) =>
                            onChange(items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))
                        }
                        aria-label={it.title}
                    />
                    <input
                        className="viagens-field"
                        value={it.title}
                        onChange={(e) =>
                            onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))
                        }
                    />
                    <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                        ×
                    </button>
                </div>
            ))}
            <div className="viagens-form-actions">
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost"
                    onClick={() =>
                        onChange([
                            ...items,
                            { id: crypto.randomUUID(), title: `Novo ${addLabel.toLowerCase()}`, done: false }
                        ])
                    }
                >
                    + {addLabel}
                </button>
            </div>
        </>
    );
}
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
    emptyFlightSimulation,
    normalizeFlightSegment,
    tripFlightSegments
} from '@motor/viagens/flight-simulation.js';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ViagensTripModuleSkeleton } from '../../../components/skeleton/viagens/ViagensTripSkeletons';
import { useTripPageSkeleton } from '../../../hooks/useTripPageSkeleton';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import type { TripDraft } from '../components/ViagemFicha';
import { normalizeGroundTransports } from '../domain/ground-transport';
import { TerrestreHeaderCta } from '../components/transporte/TerrestreHeaderCta';
import { TerrestreResumo } from '../components/transporte/TerrestreResumo';
import { TransporteModuleTabs } from '../components/transporte/TransporteModuleTabs';
import { TransporteTerrestrePanel } from '../components/transporte/TransporteTerrestrePanel';
import { VoosListaHeroBar } from '../components/voos/VoosListaHeroBar';
import { VoosResumo } from '../components/voos/VoosResumo';
import { VoosSimulationsPanel } from '../components/voos/VoosSimulationsPanel';
import { useProgramsForLedger } from '../hooks/useProgramsForLedger';
import { useTripAutosave } from '../hooks/useTripAutosave';
import { useVoosWallet } from '../hooks/useVoosWallet';
import type { MilesProgram } from '../pages/pontos/pontos-format';
import type { Trip, TripFlightSegment, TripFlightSimulation, TripGroundTransport } from '../types';

type VoosEditTarget = { segmentId: string; simulationId: string };
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/viagens-ficha-toolbar.css';
import '../styles/viagens-ficha-form.css';
import '../styles/voos-workspace.css';
import '../styles/viagens-transporte-modern.css';
import '../styles/transporte-terrestre-workspace.css';
import '../styles/orcamento-workspace.css';
import '../styles/pontos-central.css';
import '../theme/viagens-theme.css';

export type VoosOutlet = {
    trip: Trip;
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
};

function isTerrestrePath(pathname: string): boolean {
    return /\/transporte\/terrestre(?:\/|$)/.test(pathname);
}

export function ViagemVoosPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { trip, draft, error, saveError, saving, onDraftChange } = useTripAutosave(tripId);
    const { showPageSkeleton } = useTripPageSkeleton(!trip || !draft);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const isEditor = pathname.includes('/emissao/');
    const isTerrestre = isTerrestrePath(pathname);

    useEffect(() => {
        if (!tripId || isEditor) return;
        if (pathname === `/viagens/${tripId}/transporte` || pathname === `/viagens/${tripId}/transporte/`) {
            navigate(`/viagens/${tripId}/transporte/voos`, { replace: true });
        }
    }, [tripId, pathname, isEditor, navigate]);

    const { programs, loading: walletLoading, error: walletError, reload: reloadWallet } = useVoosWallet(
        tripId ?? ''
    );
    const programsForLedger = useProgramsForLedger(programs, programs.length > 0);
    const [voosFocusEdit, setVoosFocusEdit] = useState<VoosEditTarget | null>(null);
    const terrestreAddRef = useRef<(() => void) | null>(null);

    const commitFlightSegments = useCallback(
        (flight_segments: TripFlightSegment[]) => {
            const current = draftRef.current;
            if (!current) return;
            onDraftChange({
                ...current,
                payload: {
                    ...current.payload,
                    flight_segments: flight_segments.map(
                        (s) => normalizeFlightSegment(s) as TripFlightSegment
                    )
                }
            });
        },
        [draftRef, onDraftChange]
    );

    const addVoosTrecho = useCallback(() => {
        const current = draftRef.current;
        if (!current) return;
        const segments = tripFlightSegments(current.payload) as TripFlightSegment[];
        commitFlightSegments([
            ...segments,
            normalizeFlightSegment({
                id: crypto.randomUUID(),
                title: `Trecho ${segments.length + 1}`,
                simulations: []
            }) as TripFlightSegment
        ]);
    }, [commitFlightSegments, draftRef]);

    const clearVoosFocusEdit = useCallback(() => setVoosFocusEdit(null), []);

    const addPrimeiroVoos = useCallback(() => {
        const current = draftRef.current;
        if (!current) return;
        const sim = emptyFlightSimulation() as TripFlightSimulation;
        const segmentId = crypto.randomUUID();
        const segment = normalizeFlightSegment({
            id: segmentId,
            title: 'Trecho 1',
            simulations: [sim]
        }) as TripFlightSegment;
        commitFlightSegments([segment]);
        setVoosFocusEdit({ segmentId, simulationId: sim.id });
    }, [commitFlightSegments, draftRef]);

    if (error && !trip) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <p role="alert">{error}</p>
                    <ViagensBackControl label="Voltar" iconOnly onClick={() => navigate(`/viagens/${tripId}`)} />
                </div>
            </ViagensPortalSection>
        );
    }

    if (showPageSkeleton || !trip || !draft) {
        return (
            <ViagensPortalSection ficha>
                <ViagensTripModuleSkeleton variant="transporte" />
            </ViagensPortalSection>
        );
    }

    const ctx = { trip, draft, draftRef, onDraftChange } satisfies VoosOutlet;

    const transportChrome = (
        <header className="viagens-ficha__header">
            <div className="viagens-ficha__chrome">
                <div className="viagens-ficha__chrome-left">
                    <ViagensBackControl
                        label="Voltar"
                        iconOnly
                        onClick={() => navigate(`/viagens/${trip.id}`)}
                    />
                    <h1 className="viagens-module-page__title">Transportes</h1>
                </div>
                <div className="viagens-ficha__chrome-right">
                    {saving ? (
                        <span className="viagens-ficha__save-hint" aria-live="polite">
                            Salvando…
                        </span>
                    ) : null}
                </div>
            </div>
        </header>
    );

    return (
        <ViagensPortalSection ficha>
            <div className="viagens-root viagens-root--transporte">
                <div className="viagens-ficha voos-page">
                    {saveError ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {saveError}
                        </p>
                    ) : null}

                    {isEditor ? (
                        <>
                            <section className="transporte-page-header" aria-label="Transportes">
                                <div className="transporte-page-header__inner">{transportChrome}</div>
                            </section>
                            <Outlet context={ctx} />
                        </>
                    ) : (
                        <>
                            <section className="transporte-page-header" aria-label="Transportes">
                                <div className="transporte-page-header__inner">
                                    {transportChrome}
                                    <div className="transporte-page-header__aside">
                                        <TransporteModuleTabs tripId={trip.id} />
                                        {!isTerrestre ? (
                                            <VoosListaHeroBar
                                                placement="header"
                                                payload={draft.payload}
                                                onAddTrecho={addVoosTrecho}
                                                onPrimeiroVoo={addPrimeiroVoos}
                                            />
                                        ) : (
                                            <TerrestreHeaderCta
                                                onAdd={() => {
                                                    terrestreAddRef.current?.();
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </section>
                            {!isTerrestre ? (
                                <section className="transporte-hero" aria-label="Resumo de passagens e carteira">
                                    <VoosResumo
                                        tripId={trip.id}
                                        payload={draft.payload}
                                        programs={programs}
                                        programsForLedger={programsForLedger}
                                        walletLoading={walletLoading}
                                        walletError={walletError}
                                        onWalletReload={reloadWallet}
                                    />
                                </section>
                            ) : null}
                            {isTerrestre ? (
                                <TransporteTerrestreHome
                                    draft={draft}
                                    draftRef={draftRef}
                                    onDraftChange={onDraftChange}
                                    registerAddRef={terrestreAddRef}
                                />
                            ) : (
                                <VoosList
                                    tripId={trip.id}
                                    draft={draft}
                                    draftRef={draftRef}
                                    onDraftChange={onDraftChange}
                                    programsForLedger={programsForLedger}
                                    focusEdit={voosFocusEdit}
                                    onFocusEditHandled={clearVoosFocusEdit}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </ViagensPortalSection>
    );
}

function VoosList({
    tripId,
    draft,
    draftRef,
    onDraftChange,
    programsForLedger,
    focusEdit,
    onFocusEditHandled
}: {
    tripId: string;
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
    programsForLedger: MilesProgram[];
    focusEdit: VoosEditTarget | null;
    onFocusEditHandled: () => void;
}) {
    return (
        <VoosSimulationsPanel
            tripId={tripId}
            payload={draft.payload}
            destinations={draft.payload.destinations ?? []}
            tripStartsOn={draft.startsOn}
            tripEndsOn={draft.endsOn}
            programsForLedger={programsForLedger}
            focusEdit={focusEdit}
            onFocusEditHandled={onFocusEditHandled}
            onChangeSegments={(flight_segments: TripFlightSegment[]) => {
                const current = draftRef.current;
                if (!current) return;
                onDraftChange({
                    ...current,
                    payload: {
                        ...current.payload,
                        flight_segments: flight_segments.map(
                            (s) => normalizeFlightSegment(s) as TripFlightSegment
                        )
                    }
                });
            }}
        />
    );
}

function TransporteTerrestreHome({
    draft,
    draftRef,
    onDraftChange,
    registerAddRef
}: {
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
    registerAddRef: MutableRefObject<(() => void) | null>;
}) {
    const payload = draft.payload;
    const rows = normalizeGroundTransports(payload);
    const terrestreTotal = rows.reduce((s, r) => s + Math.max(0, Number(r.amount ?? 0) || 0), 0);

    return (
        <div className="voos-home terrestre-stack">
            <section className="transporte-hero transporte-hero--terrestre" aria-label="Orçamento transportes">
                <TerrestreResumo draft={draft} terrestreTotal={terrestreTotal} count={rows.length} />
            </section>
            <TransporteTerrestrePanel
                draft={draft}
                payload={payload}
                destinations={payload.destinations ?? []}
                registerAddRef={registerAddRef}
                onChange={(mutate) => {
                    const current = draftRef.current;
                    if (!current) return;
                    const prev = normalizeGroundTransports(current.payload);
                    const next = typeof mutate === 'function' ? mutate(prev) : mutate;
                    onDraftChange({
                        ...current,
                        payload: { ...current.payload, ground_transports: next, legs: [] }
                    });
                }}
            />
        </div>
    );
}
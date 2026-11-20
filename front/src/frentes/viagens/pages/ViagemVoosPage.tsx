import { useRef, type MutableRefObject } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import type { TripDraft } from '../components/ViagemFicha';
import { VoosResumo } from '../components/voos/VoosResumo';
import { VoosSimulationsPanel } from '../components/voos/VoosSimulationsPanel';
import { useProgramsForLedger } from '../hooks/useProgramsForLedger';
import { useTripAutosave } from '../hooks/useTripAutosave';
import { useVoosWallet } from '../hooks/useVoosWallet';
import type { Trip, TripFlightSegment } from '../types';
import '../styles/viagens-ficha-toolbar.css';
import '../styles/viagens-ficha-form.css';
import '../styles/voos-workspace.css';
import '../styles/pontos-central.css';
import '../theme/viagens-theme.css';

export type VoosOutlet = {
    trip: Trip;
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
};

export function ViagemVoosPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { trip, draft, error, saveError, saving, onDraftChange } = useTripAutosave(tripId);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const isEditor = pathname.includes('/emissao/');

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

    if (!trip || !draft) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <ScreenLoader label="Carregando voos" />
                </div>
            </ViagensPortalSection>
        );
    }

    const ctx = { trip, draft, draftRef, onDraftChange } satisfies VoosOutlet;

    return (
        <ViagensPortalSection ficha>
            <div className="viagens-root">
                <div className="viagens-ficha voos-page">
                    <header className="viagens-ficha__header">
                        <div className="viagens-ficha__chrome">
                            <div className="viagens-ficha__chrome-left">
                                <ViagensBackControl
                                    label="Voltar"
                                    iconOnly
                                    onClick={() => navigate(`/viagens/${trip.id}`)}
                                />
                                <div className="viagens-ficha__identity">
                                    <h1 className="voos-page__title">Voos</h1>
                                    <p className="voos-page__trip">{trip.title}</p>
                                </div>
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
                    {saveError ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {saveError}
                        </p>
                    ) : null}

                    {isEditor ? (
                        <Outlet context={ctx} />
                    ) : (
                        <VoosHome draft={draft} draftRef={draftRef} onDraftChange={onDraftChange} tripId={trip.id} />
                    )}
                </div>
            </div>
        </ViagensPortalSection>
    );
}

function VoosHome({
    tripId,
    draft,
    draftRef,
    onDraftChange
}: {
    tripId: string;
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
}) {
    const { programs, loading: walletLoading, error: walletError, reload: reloadWallet } = useVoosWallet(tripId);
    const programsForLedger = useProgramsForLedger(programs, programs.length > 0);

    return (
        <div className="voos-home">
            <VoosResumo
                tripId={tripId}
                payload={draft.payload}
                programs={programs}
                programsForLedger={programsForLedger}
                walletLoading={walletLoading}
                walletError={walletError}
                onWalletReload={reloadWallet}
            />
            <section className="voos-home__block" id="voos-board" aria-label="Registros de voo">
                <VoosSimulationsPanel
                    tripId={tripId}
                    payload={draft.payload}
                    destinations={draft.payload.destinations ?? []}
                    tripStartsOn={draft.startsOn}
                    tripEndsOn={draft.endsOn}
                    programsForLedger={programsForLedger}
                    onChangeSegments={(flight_segments: TripFlightSegment[]) => {
                        const current = draftRef.current;
                        if (!current) return;
                        onDraftChange({
                            ...current,
                            payload: { ...current.payload, flight_segments }
                        });
                    }}
                />
            </section>
        </div>
    );
}

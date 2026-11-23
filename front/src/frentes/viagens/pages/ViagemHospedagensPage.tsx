import { useRef, useState, type MutableRefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ViagensTripModuleSkeleton } from '../../../components/skeleton/viagens/ViagensTripSkeletons';
import { useTripPageSkeleton } from '../../../hooks/useTripPageSkeleton';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import type { TripDraft } from '../components/ViagemFicha';
import { HospedagensPanel } from '../components/hospedagens/HospedagensPanel';
import { HospedagensResumo } from '../components/hospedagens/HospedagensResumo';
import { useTripAutosave } from '../hooks/useTripAutosave';
import '../styles/viagens-ficha-toolbar.css';
import '../styles/voos-workspace.css';
import '../styles/viagens-simulador.css';
import '../styles/orcamento-workspace.css';
import '../styles/hospedagens-workspace.css';
import '../theme/viagens-theme.css';

export function ViagemHospedagensPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { trip, draft, error, saveError, saving, onDraftChange } = useTripAutosave(tripId);
    const { showPageSkeleton } = useTripPageSkeleton(!trip || !draft);
    const draftRef = useRef(draft);
    draftRef.current = draft;

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
                <ViagensTripModuleSkeleton variant="hospedagens" />
            </ViagensPortalSection>
        );
    }

    return (
        <ViagensPortalSection ficha>
            <div className="viagens-root">
                <div className="viagens-ficha hosp-page voos-page">
                    <header className="viagens-ficha__header">
                        <div className="viagens-ficha__chrome">
                            <div className="viagens-ficha__chrome-left">
                                <ViagensBackControl
                                    label="Voltar"
                                    iconOnly
                                    onClick={() => navigate(`/viagens/${trip.id}`)}
                                />
                                <h1 className="viagens-module-page__title">Hospedagens</h1>
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

                    <HospedagensHome draft={draft} draftRef={draftRef} onDraftChange={onDraftChange} />
                </div>
            </div>
        </ViagensPortalSection>
    );
}

function HospedagensHome({
    draft,
    draftRef,
    onDraftChange
}: {
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
}) {
    const [focusStayId, setFocusStayId] = useState<string | null>(null);
    const stays = draft.payload.stays ?? [];
    const destinations = draft.payload.destinations ?? [];

    return (
        <div className="hosp-page__home voos-home">
            <HospedagensResumo
                payload={draft.payload}
                destinations={destinations}
                focusStayId={focusStayId}
                onFocusStay={setFocusStayId}
            />
            <HospedagensPanel
                payload={draft.payload}
                destinations={destinations}
                stays={stays}
                focusStayId={focusStayId}
                onFocusStayChange={setFocusStayId}
                onChangeStays={(update) => {
                    const current = draftRef.current;
                    if (!current) return;
                    const prev = current.payload.stays ?? [];
                    const next = typeof update === 'function' ? update(prev) : update;
                    onDraftChange({
                        ...current,
                        payload: { ...current.payload, stays: next }
                    });
                }}
            />
        </div>
    );
}
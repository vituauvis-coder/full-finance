import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { deleteTrip } from '../api/trips';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagemFicha, type TripDraft } from '../components/ViagemFicha';
import { parseFichaModulo, type FichaModuloId } from '../components/ViagemModulos';
import { TripSimuladorOverlay } from '../components/TripSimuladorOverlay';
import { TripStatusControl } from '../components/TripStatusControl';
import { useTripAutosave } from '../hooks/useTripAutosave';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { DeleteIcon } from '../../../components/icons/DeleteIcon';
import { TripCountriesSelector } from '../components/TripCountriesSelector';
import { tripCreatorLabel } from '../components/tripTicketModel';
import '../styles/viagens-ficha-toolbar.css';
import '../theme/viagens-theme.css';

export function ViagemFichaPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { trip, draft, scenarioWinnerId, error, saveError, saving, onDraftChange, flushSave } =
        useTripAutosave(tripId);
    const [simOpen, setSimOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const fichaModulo = parseFichaModulo(searchParams.get('modulo'));

    function setFichaModulo(id: FichaModuloId | null) {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (id) next.set('modulo', id);
            else next.delete('modulo');
            return next;
        });
    }

    const scenarioCount = useMemo(() => {
        if (!trip) return 0;
        const list = trip.payload.time_scenarios ?? trip.payload.timeScenarios ?? [];
        return list.length;
    }, [trip]);

    const simDraft = draft;

    async function handleDelete() {
        if (!tripId || !window.confirm('Apagar esta viagem?')) return;
        await deleteTrip(tripId);
        navigate('/viagens');
    }

    function patchDraft(patch: Partial<TripDraft>) {
        if (!draft) return;
        onDraftChange({ ...draft, ...patch });
    }

    if (error && !trip) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <p role="alert">{error}</p>
                    <ViagensBackControl label="Voltar às viagens" iconOnly onClick={() => navigate('/viagens')} />
                </div>
            </ViagensPortalSection>
        );
    }

    if (!trip || !draft) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <ScreenLoader label="Carregando ficha" />
                </div>
            </ViagensPortalSection>
        );
    }

    const statusOverride = draft.statusOverride ?? '';
    const creator = tripCreatorLabel(trip);

    return (
        <ViagensPortalSection ficha>
            <div className="viagens-root">
                <div className="viagens-ficha">
                    <header className="viagens-ficha__header">
                        <div className="viagens-ficha__chrome">
                            <div className="viagens-ficha__chrome-left">
                                <ViagensBackControl
                                    label={fichaModulo ? 'Voltar' : 'Voltar às viagens'}
                                    iconOnly
                                    onClick={() => {
                                        if (fichaModulo) setFichaModulo(null);
                                        else navigate('/viagens');
                                    }}
                                />
                                <div className="viagens-ficha__identity">
                                    <input
                                        className="viagens-ficha__title"
                                        value={draft.title}
                                        onChange={(e) => patchDraft({ title: e.target.value })}
                                        aria-label="Título da viagem"
                                    />
                                    {creator ? (
                                        <p className="viagens-ficha__creator">Criada por {creator}</p>
                                    ) : null}
                                    <TripCountriesSelector
                                        payload={draft.payload}
                                        destinations={draft.payload.destinations ?? []}
                                        onChange={(tripCountries) =>
                                            patchDraft({
                                                payload: {
                                                    ...draft.payload,
                                                    tripCountries,
                                                    trip_countries: tripCountries
                                                }
                                            })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="viagens-ficha__chrome-right" aria-label="Ações da viagem">
                                {saving ? (
                                    <span className="viagens-ficha__save-hint" aria-live="polite">
                                        Salvando…
                                    </span>
                                ) : null}
                                <TripStatusControl
                                    trip={trip}
                                    statusOverride={statusOverride}
                                    onChange={(value) => patchDraft({ statusOverride: value })}
                                />
                                <button
                                    type="button"
                                    className="viagens-btn viagens-btn--ghost viagens-btn--icon viagens-ficha__delete"
                                    title="Apagar viagem"
                                    aria-label="Apagar viagem"
                                    onClick={() => void handleDelete()}
                                >
                                    <DeleteIcon size="md" />
                                </button>
                            </div>
                        </div>
                    </header>
                    {saveError ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {saveError}
                        </p>
                    ) : null}
                    <ViagemFicha
                        trip={trip}
                        draft={draft}
                        onChange={onDraftChange}
                        onFlushSave={flushSave}
                        scenarioWinnerId={scenarioWinnerId}
                        modulo={fichaModulo}
                        onModuloChange={setFichaModulo}
                        scenarioCount={scenarioCount}
                        onOpenSimulador={() => setSimOpen(true)}
                    />
                    {simOpen && simDraft ? (
                        <TripSimuladorOverlay
                            draft={simDraft}
                            scenarioWinnerId={scenarioWinnerId}
                            onClose={() => {
                                void flushSave();
                                setSimOpen(false);
                            }}
                            onDraftChange={onDraftChange}
                            onFlushSave={flushSave}
                        />
                    ) : null}
                </div>
            </div>
        </ViagensPortalSection>
    );
}
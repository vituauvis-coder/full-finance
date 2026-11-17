import { useNavigate, useParams } from 'react-router-dom';
import { deleteTrip } from '../api/trips';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagemFicha, tripToDraft, type TripDraft } from '../components/ViagemFicha';
import { useTripAutosave } from '../hooks/useTripAutosave';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import '../theme/viagens-theme.css';

export function ViagemFichaPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { trip, scenarioWinnerId, error, saveError, saving, onDraftChange } = useTripAutosave(tripId);

    async function handleDelete() {
        if (!tripId || !window.confirm('Apagar esta viagem?')) return;
        await deleteTrip(tripId);
        navigate('/viagens');
    }

    function patchTitle(title: string) {
        if (!trip) return;
        const base: TripDraft = {
            title,
            startsOn: trip.startsOn ?? '',
            endsOn: trip.endsOn ?? '',
            statusOverride: trip.statusOverride ?? '',
            budgetCaps: trip.budgetCaps,
            payload: trip.payload
        };
        onDraftChange(base);
    }

    if (error && !trip) {
        return (
            <ViagensPortalSection>
                <div className="viagens-root viagens-ficha">
                    <p role="alert">{error}</p>
                    <ViagensBackControl label="Atlas" onClick={() => navigate('/viagens')} />
                </div>
            </ViagensPortalSection>
        );
    }

    if (!trip) {
        return (
            <ViagensPortalSection>
                <div className="viagens-root viagens-ficha">
                    <ScreenLoader label="Carregando ficha" />
                </div>
            </ViagensPortalSection>
        );
    }

    return (
        <ViagensPortalSection>
            <div className="viagens-root">
                <div className="viagens-ficha">
                    <header className="viagens-ficha__header">
                        <ViagensBackControl label="Atlas" onClick={() => navigate('/viagens')} />
                        <input
                            className="viagens-ficha__title"
                            value={trip.title}
                            onChange={(e) => patchTitle(e.target.value)}
                            aria-label="Título da viagem"
                        />
                        <span className={`viagens-status-pill viagens-status-pill--${trip.effectiveStatus ?? 'planejada'}`}>
                            {trip.effectiveStatus ?? 'planejada'}
                        </span>
                        {saving ? <span className="viagens-muted">Salvando…</span> : null}
                    </header>
                    {saveError ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {saveError}
                        </p>
                    ) : null}
                    <ViagemFicha trip={trip} onChange={onDraftChange} scenarioWinnerId={scenarioWinnerId} />
                    <div className="viagens-ficha__footer-actions">
                        <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => void handleDelete()}>
                            Apagar viagem
                        </button>
                    </div>
                </div>
            </div>
        </ViagensPortalSection>
    );
}
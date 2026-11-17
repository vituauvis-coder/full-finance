import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip, saveTrip } from '../api/trips';
import { ViagemDestinoGlobe } from '../components/ViagemDestinoGlobe';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagemFicha, type TripDraft } from '../components/ViagemFicha';
import type { TripDestination } from '../types';
import { travelDestinations } from '../utils/tripOnboarding';
import { draftAsLocalTrip, emptyTripDraft } from '../utils/draftTrip';
import '../theme/viagens-theme.css';
import '../styles/viagens-nova.css';
import '../styles/viagens-nova-screen.css';

export function ViagemNovaPage() {
    const navigate = useNavigate();
    const [draft, setDraft] = useState<TripDraft>(emptyTripDraft);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const localTrip = useMemo(() => draftAsLocalTrip(draft), [draft]);
    const destinations = draft.payload.destinations ?? [];

    const dropPinOnGlobe = useCallback((lat: number, lng: number) => {
        const dest: TripDestination = {
            id: crypto.randomUUID(),
            name: 'Novo lugar',
            latitude: lat,
            longitude: lng
        };
        setDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                destinations: [...(d.payload.destinations ?? []), dest]
            }
        }));
    }, []);

    const handleSave = useCallback(async () => {
        const title = draft.title.trim();
        if (!title) {
            setError('Dê um nome à viagem.');
            return;
        }
        if (travelDestinations(draft.payload).length === 0) {
            setError('Adicione pelo menos um destino em «Para onde».');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const { trip } = await createTrip(title);
            await saveTrip(trip.id, {
                title,
                startsOn: draft.startsOn || null,
                endsOn: draft.endsOn || null,
                statusOverride: draft.statusOverride || null,
                budgetCaps: draft.budgetCaps,
                payload: {
                    ...draft.payload,
                    onboardingComplete: true
                }
            });
            navigate(`/viagens/${trip.id}`, { replace: true });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Não foi possível salvar a viagem');
        } finally {
            setSaving(false);
        }
    }, [draft, navigate]);

    return (
        <ViagensPortalSection>
            <div className="viagens-nova-screen">
                <div
                    className="viagens-nova-screen__globe viagens-map-frame viagens-map-frame--globe"
                    aria-label="Globo para escolher destino"
                >
                    <div className="viagens-map-frame__space" aria-hidden />
                    <ViagemDestinoGlobe
                        destinations={destinations}
                        status={localTrip.effectiveStatus ?? 'planejada'}
                        onTapCoord={dropPinOnGlobe}
                    />
                    <p className="viagens-nova-globe-hint">Gire o globo e clique para adicionar um destino</p>
                </div>
                <aside className="viagens-nova-screen__sheet viagens-ficha viagens-ficha--nova">
                    <header className="viagens-ficha__header">
                        <div className="viagens-ficha__toolbar">
                            <ViagensBackControl label="Atlas" onClick={() => navigate('/viagens')} />
                            <input
                                className="viagens-ficha__title"
                                value={draft.title}
                                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                                placeholder="Nome da viagem"
                                aria-label="Título da viagem"
                            />
                            <span className="viagens-status-pill viagens-status-pill--planejada">Planejada</span>
                            {saving ? <span className="viagens-muted">Salvando…</span> : null}
                        </div>
                    </header>
                    <p className="viagens-ficha__lede viagens-muted">
                        Globo à esquerda · formulário aqui. Orçamento e checklist são opcionais.
                    </p>
                    {error ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {error}
                        </p>
                    ) : null}
                    <div className="viagens-nova-screen__scroll">
                        <ViagemFicha
                            trip={localTrip}
                            draft={draft}
                            onChange={setDraft}
                            scenarioWinnerId={null}
                            externalGlobe
                        />
                    </div>
                    <div className="viagens-ficha__footer-actions viagens-ficha__footer-actions--nova">
                        <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => navigate('/viagens')}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="viagens-btn viagens-btn--coral"
                            disabled={saving}
                            onClick={() => void handleSave()}
                        >
                            {saving ? 'Salvando…' : 'Salvar viagem'}
                        </button>
                    </div>
                </aside>
            </div>
        </ViagensPortalSection>
    );
}
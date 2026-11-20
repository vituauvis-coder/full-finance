import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTripsList } from '../api/trips';
import type { MapVisit, Trip } from '../types';
import { ViagensMap } from '../components/ViagensMap';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagensCasaCentral } from '../components/ViagensCasaCentral';
import { ViagensTrilho } from '../components/ViagensTrilho';
import '../styles/viagens-casa.css';
import '../styles/viagens-header-actions.css';
import '../theme/viagens-theme.css';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

export function AtlasPage() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [visits, setVisits] = useState<MapVisit[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const data = await fetchTripsList();
            setTrips(data.trips);
            setVisits(data.visits);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha ao carregar viagens');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ViagensPortalSection>
            <div className="viagens-root">
                {error ? (
                    <p role="alert" className="viagens-toast viagens-toast--error">
                        {error}
                    </p>
                ) : null}
                {loading ? (
                    <ScreenLoader label="Carregando atlas" />
                ) : (
                    <div className="viagens-casa-layout">
                        <main className="viagens-casa-main">
                            <ViagensCasaCentral trips={trips} />
                            <div id="viagens-map-host">
                                <ViagensMap
                                    trips={trips}
                                    visits={visits}
                                    onOpenTrip={(id) => navigate(`/viagens/${id}`)}
                                />
                            </div>
                        </main>
                        <ViagensTrilho trips={trips} />
                    </div>
                )}
            </div>
        </ViagensPortalSection>
    );
}
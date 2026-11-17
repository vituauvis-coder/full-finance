import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTripsList } from '../api/trips';
import type { MapVisit, Trip } from '../types';
import { ViagensMap } from '../components/ViagensMap';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagensTrilho } from '../components/ViagensTrilho';
import '../styles/viagens-header-actions.css';
import '../theme/viagens-theme.css';

export function AtlasPage() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [visits, setVisits] = useState<MapVisit[]>([]);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchTripsList();
            setTrips(data.trips);
            setVisits(data.visits);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha ao carregar viagens');
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
                <div className="viagens-casa-layout">
                    <main className="viagens-casa-main">
                        <div id="viagens-map-host">
                            <ViagensMap trips={trips} visits={visits} onOpenTrip={(id) => navigate(`/viagens/${id}`)} />
                        </div>
                    </main>
                    <ViagensTrilho trips={trips} />
                </div>
            </div>
        </ViagensPortalSection>
    );
}
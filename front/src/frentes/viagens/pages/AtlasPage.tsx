import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTripsList } from '../api/trips';
import type { MapVisit, Trip } from '../types';
import { ViagensMap } from '../components/ViagensMap';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { ViagensCasaCentral } from '../components/ViagensCasaCentral';
import { ViagensTrilho } from '../components/ViagensTrilho';
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/viagens-casa.css';
import '../styles/viagens-atlas-sidebar.css';
import '../styles/viagens-atlas-chrome.css';
import '../styles/viagens-map-atlas-theme.css';
import '../styles/viagens-header-actions.css';
import '../theme/viagens-theme.css';
import { AtlasSkeletonLayout } from '../../../components/skeleton/viagens/ViagensTripSkeletons';
import { useViagensAtlasSkeleton } from '../../../hooks/useViagensShellVeil';

export function AtlasPage() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [visits, setVisits] = useState<MapVisit[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { routePending, showPageSkeleton } = useViagensAtlasSkeleton(loading);
    const [focusedTripId, setFocusedTripId] = useState<string | null>(null);
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

    if (routePending) return null;

    return (
        <ViagensPortalSection atlasModern>
            <div className="viagens-root">
                {error ? (
                    <p role="alert" className="viagens-toast viagens-toast--error">
                        {error}
                    </p>
                ) : null}
                {showPageSkeleton ? (
                    <AtlasSkeletonLayout />
                ) : (
                    <div className="viagens-casa-layout">
                        <div className="viagens-casa-sidebar">
                            <ViagensCasaCentral />
                            <div className="atlas-sidebar-divider" aria-hidden />
                            <ViagensTrilho trips={trips} focusedTripId={focusedTripId} />
                        </div>
                        <main className="viagens-casa-main">
                            <div id="viagens-map-host">
                                <ViagensMap
                                    trips={trips}
                                    visits={visits}
                                    focusedTripId={focusedTripId}
                                    onFocusedTripIdChange={setFocusedTripId}
                                    onOpenTrip={(id) => navigate(`/viagens/${id}`)}
                                />
                            </div>
                        </main>
                    </div>
                )}
            </div>
        </ViagensPortalSection>
    );
}
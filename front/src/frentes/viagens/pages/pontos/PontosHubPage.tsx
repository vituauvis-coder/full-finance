import { useParams } from 'react-router-dom';
import { MilesWalletHub } from '../../components/milhas/MilesWalletHub';

export function PontosHubPage() {
    const { tripId } = useParams<{ tripId: string }>();
    return <MilesWalletHub tripId={tripId} showTripEmissions />;
}
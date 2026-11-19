import { ViagensPortalSection } from '../components/ViagensPortalSection';
import { MilesWalletHub } from '../components/milhas/MilesWalletHub';
import '../styles/pontos-central.css';
import '../styles/milhas-hub-visual.css';
import '../styles/voos-workspace.css';
import '../theme/viagens-theme.css';

export function MilhasHubPage() {
    return (
        <ViagensPortalSection>
            <div className="viagens-root pontos movements-page--modern milhas-hub" id="milhas-page">
                <MilesWalletHub showGlobalKpis />
            </div>
        </ViagensPortalSection>
    );
}
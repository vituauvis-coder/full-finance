import { Navigate, Route, useParams } from 'react-router-dom';
import { AtlasPage } from './pages/AtlasPage';
import { ViagemFichaPage } from './pages/ViagemFichaPage';
import { ViagemVoosPage } from './pages/ViagemVoosPage';
import { MilhasHubPage } from './pages/MilhasHubPage';
import { PontosEmissaoEditPage } from './pages/pontos/PontosEmissaoEditPage';

function RedirectToVoos() {
    const { tripId } = useParams<{ tripId: string }>();
    return <Navigate to={`/viagens/${tripId}/voos`} replace />;
}

export const viagensRoutes = (
    <Route path="viagens">
        <Route index element={<AtlasPage />} />
        <Route path="milhas" element={<MilhasHubPage />} />
        <Route path="nova" element={<Navigate to="/viagens" replace />} />
        <Route path=":tripId/voos" element={<ViagemVoosPage />}>
            <Route path="pontos/emissao/:simId" element={<PontosEmissaoEditPage />} />
            <Route path="pontos" element={<RedirectToVoos />} />
            <Route path="pontos/carteira" element={<RedirectToVoos />} />
            <Route path="pontos/calculadora" element={<RedirectToVoos />} />
            <Route path="pontos/emissao" element={<RedirectToVoos />} />
        </Route>
        <Route path=":tripId" element={<ViagemFichaPage />} />
    </Route>
);

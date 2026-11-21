import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { readLastTripId } from '../shell/config/sidebarNav';
import { AtlasPage } from './pages/AtlasPage';
import { ViagemFichaPage } from './pages/ViagemFichaPage';
import { ViagemHospedagensPage } from './pages/ViagemHospedagensPage';
import { ViagemRoteirosPage } from './pages/ViagemRoteirosPage';
import { ViagemVoosPage } from './pages/ViagemVoosPage';
import { MilhasHubPage } from './pages/MilhasHubPage';
import { PontosEmissaoEditPage } from './pages/pontos/PontosEmissaoEditPage';

function RedirectToTransporteVoos() {
    const { tripId } = useParams<{ tripId: string }>();
    return <Navigate to={`/viagens/${tripId}/transporte/voos`} replace />;
}

function RedirectLegacyEmissaoPath() {
    const { tripId, simId } = useParams<{ tripId: string; simId: string }>();
    const { search } = useLocation();
    return <Navigate to={`/viagens/${tripId}/transporte/voos/pontos/emissao/${simId}${search}`} replace />;
}

/** URLs antigas `/voos` → `/transporte/voos`. */
function RedirectLegacyVoosPath() {
    const { tripId } = useParams<{ tripId: string }>();
    const { pathname, search } = useLocation();
    const prefix = `/viagens/${tripId}/voos`;
    const transportBase = `/viagens/${tripId}/transporte/voos`;
    const next = pathname.startsWith(prefix)
        ? `${transportBase}${pathname.slice(prefix.length)}`
        : transportBase;
    return <Navigate to={`${next}${search}`} replace />;
}

/** Atalho antigo `/viagens/hospedagens` → última viagem ou atlas. */
function ViagensHospedagensShortcut() {
    const last = readLastTripId();
    if (last) return <Navigate to={`/viagens/${last}/hospedagens`} replace />;
    return <Navigate to="/viagens" replace />;
}

function ViagensRoteirosShortcut() {
    const last = readLastTripId();
    if (last) return <Navigate to={`/viagens/${last}/roteiros`} replace />;
    return <Navigate to="/viagens" replace />;
}

export const viagensRoutes = (
    <Route path="viagens">
        <Route index element={<AtlasPage />} />
        <Route path="milhas" element={<MilhasHubPage />} />
        <Route path="nova" element={<Navigate to="/viagens" replace />} />
        <Route path="hospedagens" element={<ViagensHospedagensShortcut />} />
        <Route path="roteiros" element={<ViagensRoteirosShortcut />} />
        <Route path=":tripId">
            <Route index element={<ViagemFichaPage />} />
            <Route path="roteiros" element={<ViagemRoteirosPage />} />
            <Route path="hospedagens" element={<ViagemHospedagensPage />} />
            <Route path="transporte" element={<RedirectToTransporteVoos />} />
            <Route path="transporte/*" element={<ViagemVoosPage />}>
                <Route path="voos/pontos/emissao/:simId" element={<PontosEmissaoEditPage />} />
            </Route>
            <Route path="transporte/pontos/emissao/:simId" element={<RedirectLegacyEmissaoPath />} />
            <Route path="transporte/pontos" element={<RedirectToTransporteVoos />} />
            <Route path="transporte/voos/pontos" element={<RedirectToTransporteVoos />} />
            <Route path="transporte/voos/pontos/carteira" element={<RedirectToTransporteVoos />} />
            <Route path="transporte/voos/pontos/calculadora" element={<RedirectToTransporteVoos />} />
            <Route path="transporte/voos/pontos/emissao" element={<RedirectToTransporteVoos />} />
            <Route path="voos" element={<RedirectLegacyVoosPath />} />
            <Route path="voos/*" element={<RedirectLegacyVoosPath />} />
        </Route>
    </Route>
);
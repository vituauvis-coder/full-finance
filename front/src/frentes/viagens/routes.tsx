import { Route } from 'react-router-dom';
import { AtlasPage } from './pages/AtlasPage';
import { ViagemFichaPage } from './pages/ViagemFichaPage';
import { ViagemNovaPage } from './pages/ViagemNovaPage';

export const viagensRoutes = (
    <Route path="viagens">
        <Route index element={<AtlasPage />} />
        <Route path="nova" element={<ViagemNovaPage />} />
        <Route path=":tripId" element={<ViagemFichaPage />} />
    </Route>
);
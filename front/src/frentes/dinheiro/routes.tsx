import { Route } from 'react-router-dom';
import { EntradasPage } from './pages/EntradasPage';
import { SaidasPage } from './pages/SaidasPage';
import { PlanejamentoPage } from './pages/PlanejamentoPage';
import { CarteiraPage } from './pages/CarteiraPage';
import { CofrinhosPage } from './pages/CofrinhosPage';
import { DividasPage } from './pages/DividasPage';

export const dinheiroRoutes = (
    <>
        <Route path="dinheiro/entradas" element={<EntradasPage />} />
        <Route path="dinheiro/saidas" element={<SaidasPage />} />
        <Route path="dinheiro/planejamento" element={<PlanejamentoPage />} />
        <Route path="dinheiro/carteira" element={<CarteiraPage />} />
        <Route path="dinheiro/cofrinhos" element={<CofrinhosPage />} />
        <Route path="dinheiro/dividas" element={<DividasPage />} />
    </>
);
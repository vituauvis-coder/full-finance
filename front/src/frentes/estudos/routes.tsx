import { Route } from 'react-router-dom';
import { DisciplinaWorkspacePage } from './pages/DisciplinaWorkspacePage';
import { EstudoFichaPage } from './pages/EstudoFichaPage';
import { ExercicioWorkspacePage } from './pages/ExercicioWorkspacePage';
import { EstudosHomePage } from './pages/EstudosHomePage';

export const estudosRoutes = (
    <Route path="estudos">
        <Route index element={<EstudosHomePage />} />
        <Route path=":studyId" element={<EstudoFichaPage />} />
        <Route path=":studyId/disciplinas/:disciplineId" element={<DisciplinaWorkspacePage />} />
        <Route path=":studyId/exercicios/:exerciseId" element={<ExercicioWorkspacePage />} />
    </Route>
);
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { FinanceDataProvider } from './FinanceDataProvider';
import { LegacyAppShell } from '../components/layout/LegacyAppShell';
import { LoginPage } from '../frentes/auth/LoginPage';
import { RegisterPage } from '../frentes/auth/RegisterPage';
import { dashboardRoutes } from '../frentes/dashboard/routes';
import { dinheiroRoutes } from '../frentes/dinheiro/routes';
import { viagensRoutes } from '../frentes/viagens/routes';
import { ferramentasRoutes } from '../frentes/ferramentas/routes';
import { perfilRoutes } from '../frentes/perfil/routes';
import { ScreenLoader } from '../components/ui/ScreenLoader';
import { ConfirmProvider } from '../components/ui/confirm';
import { ThemeTransitionOverlay } from '../components/theme/ThemeTransitionOverlay';

function RequireAuth({ children }: { children: React.ReactNode }) {
    const { loading, user } = useAuth();
    if (loading) return <ScreenLoader variant="fullscreen" />;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export function App() {
    return (
        <>
            <ThemeTransitionOverlay />
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <FinanceDataProvider>
                            <ConfirmProvider>
                                <LegacyAppShell />
                            </ConfirmProvider>
                        </FinanceDataProvider>
                    </RequireAuth>
                }
            >
                {dashboardRoutes}
                {dinheiroRoutes}
                {viagensRoutes}
                {ferramentasRoutes}
                {perfilRoutes}
                <Route index element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </>
    );
}
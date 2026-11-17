import { Navigate, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';

export const dashboardRoutes = (
    <>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dinheiro/dashboard" element={<Navigate to="/dashboard" replace />} />
    </>
);
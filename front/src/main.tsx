import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './app/AuthProvider';
import { ensureChartsRegistered } from './app/registerCharts';
import './styles/legacy-imports.css';
import { applyTheme, readTheme } from './app/theme';

ensureChartsRegistered();
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
);
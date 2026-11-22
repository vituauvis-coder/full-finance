import { useEffect, useState } from 'react';
import { PROFILE_UPDATED_EVENT } from '../../../../lib/profileEvents';
import { readDashboardExpenseBuckets, readFinancialChartColors } from './fluxChartTheme';

/** Re-lê cores de Entradas/Saídas do perfil (CSS vars) após salvar no perfil ou trocar tema. */
export function useFluxAccentColors() {
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const bump = () => setRevision((n) => n + 1);
        window.addEventListener(PROFILE_UPDATED_EVENT, bump);
        window.addEventListener('meumundo-themechange', bump);
        return () => {
            window.removeEventListener(PROFILE_UPDATED_EVENT, bump);
            window.removeEventListener('meumundo-themechange', bump);
        };
    }, []);

    void revision;

    return {
        colors: readFinancialChartColors(),
        buckets: readDashboardExpenseBuckets()
    };
}
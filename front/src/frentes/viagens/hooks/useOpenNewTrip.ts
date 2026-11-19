import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip } from '../api/trips';

/** Cria viagem no servidor e abre a ficha — como no app Swift (sem tela /nova). */
export function useOpenNewTrip() {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const openNewTrip = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        try {
            const { trip } = await createTrip();
            navigate(`/viagens/${trip.id}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Não foi possível criar a viagem';
            window.alert(msg);
        } finally {
            setBusy(false);
        }
    }, [busy, navigate]);

    return { openNewTrip, busy };
}
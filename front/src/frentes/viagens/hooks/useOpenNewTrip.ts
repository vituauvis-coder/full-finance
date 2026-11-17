import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Abre a tela de cadastro; a viagem só é persistida ao salvar. */
export function useOpenNewTrip() {
    const navigate = useNavigate();

    return useCallback(() => {
        navigate('/viagens/nova');
    }, [navigate]);
}
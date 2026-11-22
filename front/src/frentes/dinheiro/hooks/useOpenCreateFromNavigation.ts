import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MovementCreateLocationState } from '../navigation/movementCreateNav';

/** Abre o modal de criação quando a navegação traz `state.openCreate`. */
export function useOpenCreateFromNavigation(openAdd: () => void) {
    const location = useLocation();
    const navigate = useNavigate();
    const openAddRef = useRef(openAdd);
    openAddRef.current = openAdd;

    useEffect(() => {
        const state = location.state as MovementCreateLocationState | null;
        if (!state?.openCreate) return;
        openAddRef.current();
        navigate(
            { pathname: location.pathname, search: location.search },
            { replace: true, state: null }
        );
    }, [location.pathname, location.search, location.state, navigate]);
}
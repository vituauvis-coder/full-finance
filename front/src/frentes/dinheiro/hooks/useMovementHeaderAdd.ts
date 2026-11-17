import { useEffect, useRef } from 'react';
import { useMovementListFilters } from '../context/MovementListFiltersContext';

/** Registra o CTA «Nova» no app-header (paridade com legacy gains/expenses header-actions). */
export function useMovementHeaderAdd(buttonId: string, onAdd: () => void) {
    const ctx = useMovementListFilters();
    const setHeaderAddAction = ctx?.setHeaderAddAction;
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    useEffect(() => {
        if (!setHeaderAddAction) return;
        setHeaderAddAction({
            id: buttonId,
            onClick: () => onAddRef.current()
        });
        return () => setHeaderAddAction(null);
    }, [setHeaderAddAction, buttonId]);
}
import { useEffect, useRef } from 'react';
import {
    useMovementListFilters,
    type MovementHeaderIconAction
} from '../context/MovementListFiltersContext';

/** Ícone secundário no header (ex.: pedidos de estorno pendentes). */
export function useMovementHeaderIcon(spec: MovementHeaderIconAction | null) {
    const ctx = useMovementListFilters();
    const setHeaderIconAction = ctx?.setHeaderIconAction;
    const onClickRef = useRef(spec?.onClick);
    onClickRef.current = spec?.onClick;

    useEffect(() => {
        if (!setHeaderIconAction) return;
        if (!spec) {
            setHeaderIconAction(null);
            return () => setHeaderIconAction(null);
        }
        setHeaderIconAction({
            id: spec.id,
            icon: spec.icon,
            title: spec.title,
            badge: spec.badge,
            onClick: () => onClickRef.current?.()
        });
        return () => setHeaderIconAction(null);
    }, [setHeaderIconAction, spec?.id, spec?.icon, spec?.title, spec?.badge, Boolean(spec)]);
}
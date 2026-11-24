import { useCallback, useEffect, useState } from 'react';
import type { EstudosStore } from '../types';
import { readEstudosStore } from '../domain/estudosStorage';

export function useEstudosStore(): EstudosStore {
    const [store, setStore] = useState<EstudosStore>(() => readEstudosStore());

    const sync = useCallback(() => {
        setStore(readEstudosStore());
    }, []);

    useEffect(() => {
        window.addEventListener('storage', sync);
        window.addEventListener('meumundo-estudos-change', sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener('meumundo-estudos-change', sync);
        };
    }, [sync]);

    return store;
}
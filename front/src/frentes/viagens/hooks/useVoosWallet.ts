import { useCallback, useEffect, useState } from 'react';
import { fetchMilesDashboard, WALLET_CHANGED } from '../api/miles';
import { milesError, type MilesProgram } from '../pages/pontos/pontos-format';

type CacheEntry = { at: number; programs: MilesProgram[] };

const CACHE_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function readCache(tripId: string): MilesProgram[] | null {
    const entry = cache.get(tripId);
    if (!entry || Date.now() - entry.at > CACHE_MS) return null;
    return entry.programs;
}

function writeCache(tripId: string, programs: MilesProgram[]) {
    cache.set(tripId, { at: Date.now(), programs });
}

export function invalidateVoosWalletCache(tripId?: string) {
    if (tripId) cache.delete(tripId);
    else cache.clear();
}

/** Uma leitura de `/api/miles/dashboard` por visita à tela Voos (com cache curto). */
export function useVoosWallet(tripId: string) {
    const [programs, setPrograms] = useState<MilesProgram[]>(() => readCache(tripId) ?? []);
    const [loading, setLoading] = useState(() => readCache(tripId) == null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        (opts?: { force?: boolean }) => {
            const cached = opts?.force ? null : readCache(tripId);
            if (cached) {
                setPrograms(cached);
                setLoading(false);
                setError(null);
                return;
            }

            setLoading(true);
            void fetchMilesDashboard(tripId)
                .then((dash) => {
                    const list = ((dash as { programs?: MilesProgram[] }).programs ?? []) as MilesProgram[];
                    writeCache(tripId, list);
                    setPrograms(list);
                    setError(null);
                })
                .catch((e: unknown) => {
                    setError(milesError(e));
                })
                .finally(() => setLoading(false));
        },
        [tripId]
    );

    useEffect(() => {
        const cached = readCache(tripId);
        setPrograms(cached ?? []);
        setLoading(cached == null);
        setError(null);
        load();
    }, [tripId, load]);

    useEffect(() => {
        const onWallet = () => {
            invalidateVoosWalletCache(tripId);
            load({ force: true });
        };
        window.addEventListener(WALLET_CHANGED, onWallet);
        return () => window.removeEventListener(WALLET_CHANGED, onWallet);
    }, [tripId, load]);

    const reload = useCallback(() => {
        invalidateVoosWalletCache(tripId);
        load({ force: true });
    }, [tripId, load]);

    return { programs, loading, error, reload };
}
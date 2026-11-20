import { useEffect, useMemo, useState } from 'react';
import { acquisitionBuckets } from '@motor/milhas/ledger.js';
import { fetchMilesMovements, WALLET_CHANGED } from '../api/miles';
import type { MilesProgram } from '../pages/pontos/pontos-format';

type WalletMove = {
    programId: string;
    type: string;
    points: number;
    amountBrl?: string | null;
    pointsSign?: number;
    source?: string;
};

function alignAssinaturaWithClubFee(program: MilesProgram, buckets: NonNullable<MilesProgram['acquisitionBuckets']>) {
    const fee = Number(program.clubFeeBrl);
    const monthly = Number(program.clubPointsPerMonth) || 0;
    if (!(fee > 0) || !(monthly > 0)) return buckets;
    return buckets.map((b) => {
        if (b.key !== 'assinatura') return b;
        const pts = Math.round(Number(b.points));
        if (pts <= 0) return b;
        const amount = Math.round(fee * (pts / monthly) * 100) / 100;
        const mil = amount / (pts / 1000);
        return {
            ...b,
            amountBrl: String(amount),
            milheiro: String(mil)
        };
    });
}

/** Carteiras com lotes do extrato para o mesmo custo no card e no editor. */
export function useProgramsForLedger(programs: MilesProgram[], enabled = true) {
    const [walletMoves, setWalletMoves] = useState<WalletMove[]>([]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const load = () => {
            void fetchMilesMovements()
                .then((res) => {
                    if (!cancelled) {
                        setWalletMoves((res as { movements?: WalletMove[] }).movements ?? []);
                    }
                })
                .catch(() => {
                    if (!cancelled) setWalletMoves([]);
                });
        };
        load();
        window.addEventListener(WALLET_CHANGED, load);
        return () => {
            cancelled = true;
            window.removeEventListener(WALLET_CHANGED, load);
        };
    }, [enabled]);

    return useMemo(
        () =>
            programs.map((p) => {
                const built =
                    walletMoves.length > 0
                        ? acquisitionBuckets(walletMoves, p.id).map((b) => ({
                              key: b.key,
                              label: b.label,
                              points: Math.round(b.points),
                              amountBrl: b.amountBrl.toString(),
                              milheiro: b.milheiro.toString()
                          }))
                        : [];
                const buckets = built.length ? built : p.acquisitionBuckets ?? [];
                if (!buckets.length) return p;
                return {
                    ...p,
                    acquisitionBuckets: alignAssinaturaWithClubFee(p, buckets)
                };
            }),
        [programs, walletMoves]
    );
}
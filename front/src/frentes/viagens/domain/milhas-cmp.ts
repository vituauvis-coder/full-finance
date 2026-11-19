import type { MilesProgram } from '../pages/pontos/pontos-format';

export function programMilheiro(program: Pick<MilesProgram, 'milheiro'>) {
    const n = Number(program.milheiro);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function saldoEmReais(program: Pick<MilesProgram, 'balance' | 'milheiro'>) {
    const cmp = programMilheiro(program);
    const pts = Math.max(0, Math.round(Number(program.balance) || 0));
    if (cmp == null || pts <= 0) return null;
    return (pts / 1000) * cmp;
}

export function totalSaldoEmReais(programs: MilesProgram[]) {
    let total = 0;
    let any = false;
    for (const p of programs) {
        const brl = saldoEmReais(p);
        if (brl != null) {
            total += brl;
            any = true;
        }
    }
    return any ? total : null;
}

/** Milheiro na origem a partir de compra avulsa. */
export function milheiroFromPurchase(paidBrl: number, points: number) {
    const paid = Math.max(0, Number(paidBrl) || 0);
    const pts = Math.max(0, Math.round(Number(points) || 0));
    if (paid <= 0 || pts <= 0) return null;
    return paid / (pts / 1000);
}

/** Milheiro efetivo no destino após pagar `paidBrl` e receber `destPoints`. */
export function milheiroNoDestino(paidBrl: number, destPoints: number) {
    const paid = Math.max(0, Number(paidBrl) || 0);
    const dest = Math.max(0, Math.round(Number(destPoints) || 0));
    if (paid <= 0 || dest <= 0) return null;
    return paid / (dest / 1000);
}
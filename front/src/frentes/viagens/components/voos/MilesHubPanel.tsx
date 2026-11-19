import { useMemo, useState } from 'react';
import {
    compareCashVsPoints,
    MILES_PROGRAMS,
    normalizeMilesWallet
} from '@motor/viagens/miles-wallet.js';
import { simulationFinalCost, simulationLabelLine, tripFlightSegments } from '@motor/viagens/flight-simulation.js';
import { formatBRL } from '../../utils/map-utils';
import { useMilesWallet, type MilesProgram, type MilesWallet } from '../../hooks/useMilesWallet';
import type { TripPayload } from '../../types';

type Props = {
    payload: TripPayload;
};

function money(n: number | null | undefined) {
    if (n == null || !Number.isFinite(n)) return '—';
    return formatBRL(n);
}

export function MilesHubPanel({ payload }: Props) {
    const { wallet, loading, saving, persist } = useMilesWallet();
    const [cashBrl, setCashBrl] = useState('');
    const [pointsRequired, setPointsRequired] = useState('');
    const [programId, setProgramId] = useState('esfera');

    const programs = wallet.programs;
    const selected = programs.find((p) => p.id === programId) ?? programs[0];

    const chosenFlights = useMemo(() => {
        const segs = tripFlightSegments(payload);
        return segs.flatMap((seg: { title: string; simulations: Array<Record<string, unknown>> }) =>
            (seg.simulations ?? [])
                .filter((s) => s.status === 'escolhida' || s.status === 'candidata')
                .map((s) => ({
                    id: String(s.id),
                    title: `${seg.title} · ${simulationLabelLine(s)}`,
                    cost: simulationFinalCost(s) as number
                }))
        );
    }, [payload]);

    const comparison = useMemo(() => {
        if (!selected) return null;
        return compareCashVsPoints({
            cashBrl: Number(cashBrl) || 0,
            pointsRequired: Number(pointsRequired) || 0,
            milheiroBrl: selected.milheiroBrl,
            balance: selected.balance
        });
    }, [cashBrl, pointsRequired, selected]);

    function setPrograms(next: MilesProgram[]) {
        persist(normalizeMilesWallet({ programs: next }) as MilesWallet);
    }

    function patchProgram(id: string, patch: Partial<MilesProgram>) {
        setPrograms(
            programs.map((p) =>
                p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
            )
        );
    }

    function addProgram(brand: string) {
        const meta = MILES_PROGRAMS.find((p: { brand: string }) => p.brand === brand);
        if (!meta) return;
        if (brand !== 'outro' && programs.some((p) => p.brand === brand)) return;
        const id = brand === 'outro' ? `outro-${crypto.randomUUID().slice(0, 8)}` : brand;
        setPrograms([
            ...programs,
            {
                id,
                brand,
                name: meta.name,
                balance: 0,
                milheiroBrl: 14,
                updatedAt: new Date().toISOString()
            }
        ]);
        setProgramId(id);
    }

    if (loading) {
        return <p className="voos-muted">Carregando carteira de milhas…</p>;
    }

    return (
        <div className="voos-miles">
            <header className="voos-miles__intro">
                <div>
                    <h2>Casa das milhas</h2>
                    <p>
                        Saldos da conta — valem em qualquer viagem. A Esfera (Santander) já vem cadastrada. Bancos não
                        publicam API de pontos: informe o saldo e o milheiro.
                    </p>
                </div>
                {saving ? <span className="voos-muted">Salvando…</span> : null}
            </header>

            <div className="voos-miles-grid">
                {programs.map((p) => (
                    <article
                        key={p.id}
                        className={`voos-miles-card${p.brand === 'esfera' ? ' voos-miles-card--esfera' : ''}${
                            selected?.id === p.id ? ' is-selected' : ''
                        }`}
                    >
                        <button type="button" className="voos-miles-card__pick" onClick={() => setProgramId(p.id)}>
                            {p.brand === 'esfera' ? 'Santander · Esfera' : p.name}
                        </button>
                        <label className="voos-field">
                            <span>Saldo (pts)</span>
                            <input
                                className="viagens-field"
                                type="number"
                                min={0}
                                value={p.balance}
                                onChange={(e) => patchProgram(p.id, { balance: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                            />
                        </label>
                        <label className="voos-field">
                            <span>Milheiro (R$ / 1.000)</span>
                            <input
                                className="viagens-field"
                                type="number"
                                min={0}
                                step="0.01"
                                value={p.milheiroBrl}
                                onChange={(e) => patchProgram(p.id, { milheiroBrl: Number(e.target.value) || 0 })}
                            />
                        </label>
                        {p.brand !== 'esfera' ? (
                            <button
                                type="button"
                                className="voos-text-btn voos-text-btn--danger"
                                onClick={() => setPrograms(programs.filter((x) => x.id !== p.id))}
                            >
                                Remover
                            </button>
                        ) : (
                            <p className="voos-muted">Programa principal</p>
                        )}
                    </article>
                ))}
            </div>

            <div className="voos-miles-add">
                <span>Incluir programa</span>
                {MILES_PROGRAMS.filter(
                    (m: { brand: string }) => m.brand === 'outro' || !programs.some((p) => p.brand === m.brand)
                ).map((m: { brand: string; name: string }) => (
                    <button key={m.brand} type="button" className="voos-pill voos-pill--oceano" onClick={() => addProgram(m.brand)}>
                        + {m.name}
                    </button>
                ))}
            </div>

            <section className="voos-compare">
                <h3>Simular R$ vs pontos</h3>
                <p className="voos-muted">
                    Compare o preço em dinheiro com o custo implícito dos pontos (milheiro × quantidade).
                </p>
                {chosenFlights.length > 0 ? (
                    <div className="voos-compare__flights">
                        {chosenFlights
                            .filter((f) => f.cost > 0)
                            .map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className="voos-pill"
                                    onClick={() => setCashBrl(String(Math.round(f.cost)))}
                                >
                                    Usar {f.title} · {formatBRL(f.cost)}
                                </button>
                            ))}
                    </div>
                ) : null}
                <div className="voos-compare__grid">
                    <label className="voos-field">
                        <span>Trecho em R$</span>
                        <input
                            className="viagens-field"
                            type="number"
                            min={0}
                            value={cashBrl}
                            onChange={(e) => setCashBrl(e.target.value)}
                        />
                    </label>
                    <label className="voos-field">
                        <span>Pontos da emissão</span>
                        <input
                            className="viagens-field"
                            type="number"
                            min={0}
                            value={pointsRequired}
                            onChange={(e) => setPointsRequired(e.target.value)}
                        />
                    </label>
                    <label className="voos-field">
                        <span>Programa</span>
                        <select className="viagens-field" value={selected?.id ?? ''} onChange={(e) => setProgramId(e.target.value)}>
                            {programs.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {comparison && (Number(cashBrl) > 0 || Number(pointsRequired) > 0) ? (
                    <div className={`voos-compare__result voos-compare__result--${comparison.cheaper}`}>
                        <p>
                            Dinheiro: <strong>{money(comparison.cashBrl)}</strong>
                        </p>
                        <p>
                            Pontos em R$:{' '}
                            <strong>{comparison.pointsCostBrl != null ? money(comparison.pointsCostBrl) : '—'}</strong>
                            {selected ? ` · milheiro ${formatBRL(selected.milheiroBrl)}` : null}
                        </p>
                        <p>
                            {comparison.enoughPoints
                                ? 'Saldo cobre a emissão.'
                                : `Faltam ${comparison.missingPoints.toLocaleString('pt-BR')} pontos.`}
                        </p>
                        <p className="voos-compare__verdict">
                            {comparison.cheaper === 'points'
                                ? `Pontos saem ${money(Math.abs(comparison.savingBrl ?? 0))} mais baratos.`
                                : comparison.cheaper === 'cash'
                                  ? `Dinheiro sai ${money(Math.abs(comparison.savingBrl ?? 0))} mais barato.`
                                  : 'Empate entre dinheiro e pontos.'}
                        </p>
                    </div>
                ) : null}
            </section>
        </div>
    );
}

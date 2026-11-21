import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { compareEmissionOptions } from '@motor/milhas/emission.js';
import { emitEmission, fetchEmission, fetchMilesPrograms, patchEmission, reserveEmission } from '../../api/miles';
import { formatBRL } from '../../utils/map-utils';
import {
    BonusBar,
    ChipRow,
    DecimalField,
    PontosAlert,
    PtsField,
    RatioBar,
    SelectField,
    TextField
} from './PontosFields';
import { formatPts, milesError, statusLabel, type MilesProgram } from './pontos-format';

type Option = {
    id: string;
    label: string;
    destinationPoints: number;
    taxesAmount: number;
    taxesCurrency: string;
};

function moneyOf(v: unknown) {
    if (v == null) return 0;
    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
        return Number((v as { toNumber: () => number }).toNumber());
    }
    return Number(v);
}

export function PontosEmissaoEditPage() {
    const { tripId, simId } = useParams<{ tripId: string; simId: string }>();
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('rascunho');
    const [conversionFrom, setConversionFrom] = useState(2);
    const [conversionTo, setConversionTo] = useState(1);
    const [bonusPercent, setBonusPercent] = useState(0);
    const [buyMilheiro, setBuyMilheiro] = useState(14);
    const [fxRate, setFxRate] = useState(6.2);
    const [iofPercent, setIofPercent] = useState(3.5);
    const [spreadPercent, setSpreadPercent] = useState(2);
    const [clubFeeBrl, setClubFeeBrl] = useState(0);
    const [originProgramId, setOriginProgramId] = useState('');
    const [destinationProgramId, setDestinationProgramId] = useState('');
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [options, setOptions] = useState<Option[]>([]);
    const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!simId) return;
        const [{ emission }, progs] = await Promise.all([
            fetchEmission(simId) as Promise<{ emission: Record<string, unknown> & { options: Option[] } }>,
            fetchMilesPrograms()
        ]);
        setPrograms(progs.programs ?? []);
        setTitle(String(emission.title ?? ''));
        setStatus(String(emission.status ?? 'rascunho'));
        setConversionFrom(Number(emission.conversionFrom) || 1);
        setConversionTo(Number(emission.conversionTo) || 1);
        setBonusPercent(Number(emission.bonusPercent) || 0);
        setBuyMilheiro(Number(emission.buyMilheiro) || 0);
        setFxRate(Number(emission.fxRate) || 1);
        setIofPercent(Number(emission.iofPercent) || 0);
        setSpreadPercent(Number(emission.spreadPercent) || 0);
        setClubFeeBrl(Number(emission.clubFeeBrl) || 0);
        setOriginProgramId(String(emission.originProgramId ?? ''));
        setDestinationProgramId(String(emission.destinationProgramId ?? ''));
        setChosenOptionId(emission.chosenOptionId ? String(emission.chosenOptionId) : null);
        setOptions(
            (emission.options ?? []).map((o, i) => ({
                id: o.id || crypto.randomUUID(),
                label: o.label || String.fromCharCode(65 + i),
                destinationPoints: Number(o.destinationPoints) || 0,
                taxesAmount: Number(o.taxesAmount) || 0,
                taxesCurrency: o.taxesCurrency || 'EUR'
            }))
        );
    }, [simId]);

    useEffect(() => {
        void load().catch((e: unknown) => setError(milesError(e)));
    }, [load]);

    const origin = programs.find((p) => p.id === originProgramId);
    const dest = programs.find((p) => p.id === destinationProgramId);
    const locked = status === 'emitida';

    const simPayload = {
        conversionFrom,
        conversionTo,
        bonusPercent,
        buyMilheiro,
        buyDiscountPercent: 0,
        buyExtraFee: 0,
        fxRate,
        iofPercent,
        spreadPercent,
        clubFeeBrl
    };

    const preview = useMemo(() => {
        if (!options.length) return null;
        return compareEmissionOptions(
            simPayload,
            options.map((o) => ({
                id: o.id,
                destinationPoints: o.destinationPoints,
                taxesAmount: o.taxesAmount
            })),
            origin?.balance ?? 0,
            Number(origin?.milheiro) || 0
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps -- payload is derived
    }, [
        options,
        conversionFrom,
        conversionTo,
        bonusPercent,
        buyMilheiro,
        fxRate,
        iofPercent,
        spreadPercent,
        clubFeeBrl,
        origin?.balance,
        origin?.milheiro
    ]);

    async function save() {
        if (!simId || locked) return;
        setSaving(true);
        setError(null);
        try {
            await patchEmission(simId, {
                title,
                originProgramId,
                destinationProgramId,
                conversionFrom,
                conversionTo,
                bonusPercent,
                buyMilheiro,
                fxRate,
                iofPercent,
                spreadPercent,
                clubFeeBrl,
                chosenOptionId,
                options: options.map((o) => ({
                    id: o.id,
                    label: o.label,
                    destinationPoints: o.destinationPoints,
                    taxesAmount: o.taxesAmount,
                    taxesCurrency: o.taxesCurrency
                }))
            });
            await load();
        } catch (e) {
            setError(milesError(e));
            throw e;
        } finally {
            setSaving(false);
        }
    }

    async function run(kind: 'reserve' | 'emit') {
        if (!simId) return;
        setError(null);
        try {
            await save();
            if (kind === 'reserve') await reserveEmission(simId);
            else await emitEmission(simId);
            await load();
        } catch (e) {
            setError(milesError(e));
        }
    }

    function addOption() {
        const label = String.fromCharCode(65 + options.length);
        setOptions([
            ...options,
            {
                id: crypto.randomUUID(),
                label,
                destinationPoints: 0,
                taxesAmount: 0,
                taxesCurrency: dest?.brand === 'iberia' || dest?.brand === 'tap' ? 'EUR' : 'USD'
            }
        ]);
    }

    function patchOption(id: string, patch: Partial<Option>) {
        setOptions(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    }

    return (
        <div className="pontos-view">
            <PontosAlert>{error}</PontosAlert>
            <header className="pontos-sim-head">
                <Link className="voos-text-btn" to={`/viagens/${tripId}/transporte/voos`}>
                    ← Voos
                </Link>
                <span className={`pontos-status pontos-status--${status}`}>{statusLabel(status)}</span>
            </header>
            <TextField label="Nome" value={title} onChange={setTitle} />

            <details className="pontos-sheet" open>
                <summary>Premissas</summary>
                <div className="pontos-form-grid">
                    <SelectField label="Origem dos pontos" value={originProgramId} onChange={setOriginProgramId}>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} · {formatPts(p.balance)}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField label="Programa da emissão" value={destinationProgramId} onChange={setDestinationProgramId}>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </SelectField>
                </div>
                <RatioBar from={conversionFrom} to={conversionTo} onChange={(a, b) => (setConversionFrom(a), setConversionTo(b))} />
                <BonusBar value={bonusPercent} onChange={setBonusPercent} />
                <div className="pontos-form-grid">
                    <DecimalField label="Milheiro de compra" value={buyMilheiro} onChange={setBuyMilheiro} suffix="R$" />
                    <DecimalField label="Câmbio → BRL" value={fxRate} onChange={setFxRate} />
                    <DecimalField label="IOF" value={iofPercent} onChange={setIofPercent} suffix="%" />
                    <DecimalField label="Spread" value={spreadPercent} onChange={setSpreadPercent} suffix="%" />
                    <DecimalField label="Clube no período" value={clubFeeBrl} onChange={setClubFeeBrl} suffix="R$" />
                </div>
            </details>

            <div className="pontos-options-head">
                <h3>Opções</h3>
                {locked ? null : (
                    <button type="button" className="voos-pill voos-pill--oceano" onClick={addOption}>
                        + Opção
                    </button>
                )}
            </div>

            {options.length === 0 ? (
                <p className="voos-muted">Adicione a opção A, B, C… com milhas e taxas de cada tarifa.</p>
            ) : (
                <div className="pontos-options">
                    {options.map((opt) => {
                        const row = preview?.options.find((p: { id?: string }) => p.id === opt.id);
                        const seals = [
                            preview?.lowestOutlayId === opt.id ? 'Menor desembolso' : null,
                            preview?.lowestEconomicId === opt.id ? 'Menor econômico' : null,
                            preview?.bestValueId === opt.id ? 'Melhor custo-benefício' : null
                        ].filter(Boolean) as string[];
                        const on = chosenOptionId === opt.id;
                        return (
                            <article key={opt.id} className={`pontos-option${on ? ' is-on' : ''}`}>
                                <header>
                                    <input
                                        className="viagens-field pontos-input pontos-option__label"
                                        value={opt.label}
                                        onChange={(e) => patchOption(opt.id, { label: e.target.value })}
                                        disabled={locked}
                                    />
                                    {locked ? null : (
                                        <button
                                            type="button"
                                            className={`voos-pill${on ? ' voos-pill--turquesa' : ''}`}
                                            onClick={() => setChosenOptionId(opt.id)}
                                        >
                                            {on ? 'Escolhida' : 'Escolher'}
                                        </button>
                                    )}
                                </header>
                                <PtsField
                                    label={`Milhas ${dest?.name ?? 'destino'}`}
                                    value={opt.destinationPoints}
                                    onChange={(n) => patchOption(opt.id, { destinationPoints: n })}
                                />
                                <div className="pontos-form-grid">
                                    <DecimalField
                                        label="Taxas"
                                        value={opt.taxesAmount}
                                        onChange={(n) => patchOption(opt.id, { taxesAmount: n })}
                                    />
                                    <SelectField
                                        label="Moeda"
                                        value={opt.taxesCurrency}
                                        onChange={(v) => patchOption(opt.id, { taxesCurrency: v })}
                                    >
                                        {['EUR', 'USD', 'GBP', 'BRL'].map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </SelectField>
                                </div>
                                {row ? (
                                    <dl className="pontos-metrics">
                                        <div>
                                            <dt>Origem necessária</dt>
                                            <dd>{formatPts(row.originNeeded)}</dd>
                                        </div>
                                        <div>
                                            <dt>Já tem</dt>
                                            <dd>{formatPts(row.ownPoints)}</dd>
                                        </div>
                                        <div>
                                            <dt>Comprar</dt>
                                            <dd>{formatPts(row.pointsToBuy)}</dd>
                                        </div>
                                        <div>
                                            <dt>Desembolso</dt>
                                            <dd>{formatBRL(moneyOf(row.outlay))}</dd>
                                        </div>
                                        <div>
                                            <dt>Custo econômico</dt>
                                            <dd>{formatBRL(moneyOf(row.economic))}</dd>
                                        </div>
                                    </dl>
                                ) : null}
                                {seals.length ? (
                                    <ChipRow>
                                        {seals.map((s) => (
                                            <span key={s} className="pontos-seal">
                                                {s}
                                            </span>
                                        ))}
                                    </ChipRow>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            )}

            {locked ? null : (
                <div className="pontos-actions">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => void save()} disabled={saving}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => void run('reserve')} disabled={saving}>
                        Reservar pontos
                    </button>
                    <button type="button" className="pontos-btn-primary" onClick={() => void run('emit')} disabled={saving}>
                        Registrar emissão
                    </button>
                </div>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { convertPoints } from '@motor/milhas/convert.js';
import { rateForPair, unitLabel } from '@motor/milhas/catalog.js';
import { formatBRL } from '../../utils/map-utils';
import {
    BonusBar,
    Chip,
    ChipRow,
    DecimalField,
    PtsField,
    RatioBar,
    SelectField
} from '../../pages/pontos/PontosFields';
import { formatPts, type ConversionRate, type MilesProgram } from '../../pages/pontos/pontos-format';
import {
    milheiroFromPurchase,
    milheiroNoDestino,
    programMilheiro
} from '../../domain/milhas-cmp';

type Props = {
    programs: MilesProgram[];
    rates: ConversionRate[];
    originProgramId?: string;
    embedded?: boolean;
};

export function MilhasMilheiroCalculator({ programs, rates, originProgramId, embedded }: Props) {
    const [mode, setMode] = useState<'compra' | 'cadeia'>('cadeia');
    const [paidBrl, setPaidBrl] = useState(0);
    const [boughtPts, setBoughtPts] = useState(0);
    const [fromId, setFromId] = useState(originProgramId ?? programs[0]?.id ?? '');
    const [toId, setToId] = useState('');
    const [originPts, setOriginPts] = useState(0);
    const [convFrom, setConvFrom] = useState(2);
    const [convTo, setConvTo] = useState(1);
    const [bonus, setBonus] = useState(0);

    const from = programs.find((p) => p.id === fromId);
    const to = programs.find((p) => p.id === toId);
    const savedPair = rates.find((r) => r.fromProgramId === fromId && r.toProgramId === toId);

    useEffect(() => {
        if (!fromId) return;
        const other = programs.find((p) => p.id !== fromId);
        if (!toId && other) setToId(other.id);
    }, [fromId, programs, toId]);

    useEffect(() => {
        if (!fromId || !toId || fromId === toId) return;
        const next = rateForPair(savedPair, from?.unit, to?.unit, from?.transferBonusPercent);
        setConvFrom(next.from);
        setConvTo(next.to);
        setBonus(next.bonusPercent);
    }, [fromId, toId, from?.unit, to?.unit, from?.transferBonusPercent, savedPair]);

    useEffect(() => {
        if (boughtPts > 0 && originPts === 0) setOriginPts(boughtPts);
    }, [boughtPts, originPts]);

    const milheiroOrigemCompra = useMemo(
        () => milheiroFromPurchase(paidBrl, boughtPts),
        [paidBrl, boughtPts]
    );

    const milheiroOrigemCarteira = from ? programMilheiro(from) : null;

    const preview = useMemo(
        () =>
            convertPoints({
                originPoints: mode === 'cadeia' ? originPts : boughtPts,
                from: convFrom,
                to: convTo,
                bonusPercent: bonus
            }),
        [mode, originPts, boughtPts, convFrom, convTo, bonus]
    );

    const custoConsiderado = paidBrl > 0 ? paidBrl : null;
    const milheiroDestino = useMemo(() => {
        if (mode !== 'cadeia' || !custoConsiderado || preview.total <= 0) return null;
        return milheiroNoDestino(custoConsiderado, preview.total);
    }, [mode, custoConsiderado, preview.total]);

    const milheiroOrigemEfetivo = milheiroOrigemCompra ?? milheiroOrigemCarteira;

    const shell = embedded
        ? 'milhas-pane milhas-pane--form pontos-milheiro-calc'
        : 'pontos-sheet pontos-sheet--form pontos-milheiro-calc';

    return (
        <article className={shell}>
            {!embedded ? <p className="pontos-kicker">Calculadora</p> : null}
            {!embedded ? <h3>Milheiro real (CMP)</h3> : null}
            <p className="voos-muted">
                {embedded
                    ? 'Paguei X reais, ganhei Y pontos — e, se transferir, quanto custa cada milheiro no destino.'
                    : 'Quanto custa cada 1.000 pontos na compra e, se transferir, no programa de destino.'}
            </p>

            <ChipRow>
                <Chip on={mode === 'compra'} onClick={() => setMode('compra')}>
                    Só compra
                </Chip>
                <Chip on={mode === 'cadeia'} onClick={() => setMode('cadeia')}>
                    Compra + transferência
                </Chip>
            </ChipRow>

            <DecimalField label="Quanto pagou (R$)" value={paidBrl} onChange={setPaidBrl} suffix="R$" />
            <PtsField
                label={`Pontos comprados${from ? ` · ${from.name}` : ''}`}
                value={boughtPts}
                onChange={setBoughtPts}
            />

            {mode === 'cadeia' ? (
                <>
                    <div className="pontos-form-grid">
                        <SelectField label="Sai de" value={fromId} onChange={setFromId}>
                            {programs.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </SelectField>
                        <SelectField label="Entra em" value={toId} onChange={setToId}>
                            {programs.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </SelectField>
                    </div>
                    <PtsField
                        label={`${unitLabel(from?.unit || 'pontos', 2)} transferidos`}
                        value={originPts}
                        onChange={setOriginPts}
                        hint={
                            boughtPts > 0 && originPts !== boughtPts
                                ? `Dica: use os ${formatPts(boughtPts)} comprados`
                                : undefined
                        }
                    />
                    <RatioBar
                        from={convFrom}
                        to={convTo}
                        fromUnit={from?.unit}
                        toUnit={to?.unit}
                        onChange={(a, b) => {
                            setConvFrom(a);
                            setConvTo(b);
                        }}
                    />
                    <BonusBar value={bonus} onChange={setBonus} />
                </>
            ) : (
                <SelectField label="Carteira" value={fromId} onChange={setFromId}>
                    {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </SelectField>
            )}

            <div className="pontos-score pontos-score--milheiro">
                <div>
                    <span>Milheiro na origem</span>
                    <strong>{milheiroOrigemEfetivo != null ? formatBRL(milheiroOrigemEfetivo) : '—'}</strong>
                    <em>{milheiroOrigemCompra != null ? 'desta compra' : from ? 'média da carteira' : ''}</em>
                </div>
                {mode === 'cadeia' && to ? (
                    <>
                        <div>
                            <span>Chegam em {to.name}</span>
                            <strong>
                                {formatPts(preview.total)}{' '}
                                {unitLabel(to.unit || 'pontos', preview.total || 2)}
                            </strong>
                            <em>
                                +{formatPts(preview.bonus)} bônus · base {formatPts(preview.base)}
                            </em>
                        </div>
                        <div className="pontos-score__total">
                            <span>Milheiro em {to.name}</span>
                            <strong>{milheiroDestino != null ? formatBRL(milheiroDestino) : '—'}</strong>
                            <em>{paidBrl > 0 ? 'custo total ÷ pontos no destino' : 'informe o valor pago'}</em>
                        </div>
                    </>
                ) : null}
            </div>
        </article>
    );
}
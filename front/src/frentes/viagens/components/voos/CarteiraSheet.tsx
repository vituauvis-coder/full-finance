import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { convertPoints } from '@motor/milhas/convert.js';
import { rateForPair, unitLabel } from '@motor/milhas/catalog.js';
import {
    createMilesProgram,
    deleteMilesMovement,
    fetchMilesDashboard,
    fetchMilesMovements,
    fetchMilesPrograms,
    patchMilesProgram,
    notifyWalletChanged,
    postMilesMovement,
    setMilesBalance
} from '../../api/miles';
import { formatBRL } from '../../utils/map-utils';
import {
    BonusBar,
    DecimalField,
    PontosAlert,
    PtsField,
    RatioBar,
    SelectField,
    TextField
} from '../../pages/pontos/PontosFields';
import { PontosWalletEditor, type WalletDraft } from '../../pages/pontos/PontosWalletEditor';
import { WalletBenefits } from '../../pages/pontos/WalletBenefits';
import {
    dateLabel,
    formatPts,
    isDebit,
    milesError,
    movementLabel,
    type ConversionRate,
    type MilesProgram
} from '../../pages/pontos/pontos-format';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

const LAUNCH_TYPES = [
    ['acumulo', 'Acúmulo'],
    ['compra', 'Compra'],
    ['bonus', 'Bônus'],
    ['expiracao', 'Expiração']
] as const;

type Move = {
    id: string;
    type: string;
    points: number;
    pointsSign?: number;
    occurredOn: string;
    notes: string;
    programId: string;
    amountBrl?: string | null;
    source?: string;
};

type Props = {
    tripId?: string;
    programId: string | 'create';
    onClose: () => void;
    onChanged: () => void;
};

export function CarteiraSheet({ tripId, programId, onClose, onChanged }: Props) {
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [rates, setRates] = useState<ConversionRate[]>([]);
    const [movements, setMovements] = useState<Move[]>([]);
    const [selectedId, setSelectedId] = useState(programId === 'create' ? '' : programId);
    const [tool, setTool] = useState<'log' | 'lancar' | 'transferir'>('log');
    const [type, setType] = useState('acumulo');
    const [points, setPoints] = useState(0);
    const [amount, setAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [fromId, setFromId] = useState(programId === 'create' ? '' : programId);
    const [toId, setToId] = useState('');
    const [originPts, setOriginPts] = useState(0);
    const [convFrom, setConvFrom] = useState(2);
    const [convTo, setConvTo] = useState(1);
    const [bonus, setBonus] = useState(0);
    const [rateSource, setRateSource] = useState<'saved' | 'suggested' | 'wallet'>('suggested');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editor, setEditor] = useState<'create' | 'edit' | null>(programId === 'create' ? 'create' : null);
    const [ready, setReady] = useState(false);

    function bump() {
        onChanged();
        notifyWalletChanged();
    }

    const load = useCallback(async () => {
        const [p, m, d] = await Promise.all([
            fetchMilesPrograms(),
            fetchMilesMovements(),
            fetchMilesDashboard(tripId)
        ]);
        const extra = ((d as { programs?: MilesProgram[] }).programs ?? []) as MilesProgram[];
        const list = (p.programs ?? []).map((prog) => {
            const dash = extra.find((x) => x.id === prog.id);
            if (!dash) return prog;
            const buy = Number(prog.buyMilheiro) || Number(dash.buyMilheiro) || 0;
            return {
                ...prog,
                ...dash,
                buyMilheiro: buy > 0 ? String(buy) : prog.buyMilheiro ?? dash.buyMilheiro,
                milheiro: dash.milheiro,
                invested: dash.invested
            };
        });
        setPrograms(list);
        setRates(p.rates ?? []);
        setMovements((m as { movements: Move[] }).movements ?? []);
        setSelectedId((id) => id || list[0]?.id || '');
        setFromId((id) => id || list[0]?.id || '');
        setToId((id) => {
            const origin = id || list[0]?.id;
            return list.find((x) => x.id !== origin)?.id || list[0]?.id || '';
        });
        setReady(true);
        return list;
    }, [tripId]);

    useEffect(() => {
        void load().catch((err: unknown) => {
            setError(milesError(err));
            setReady(true);
        });
    }, [load]);

    useEffect(() => {
        if (programId !== 'create') {
            setSelectedId(programId);
            setFromId(programId);
        }
    }, [programId]);

    const selected = programs.find((p) => p.id === selectedId);
    const from = programs.find((p) => p.id === fromId);
    const to = programs.find((p) => p.id === toId);
    const savedPair = rates.find((r) => r.fromProgramId === fromId && r.toProgramId === toId);
    const savedKey = savedPair
        ? `${savedPair.conversionFrom}:${savedPair.conversionTo}:${savedPair.bonusPercent}`
        : '';

    useEffect(() => {
        if (!fromId || !toId || fromId === toId) return;
        const next = rateForPair(savedPair, from?.unit, to?.unit, from?.transferBonusPercent);
        setConvFrom(next.from);
        setConvTo(next.to);
        setBonus(next.bonusPercent);
        setRateSource(next.source === 'saved' ? 'saved' : next.source === 'wallet' ? 'wallet' : 'suggested');
    }, [fromId, toId, from?.unit, to?.unit, from?.transferBonusPercent, savedKey]);

    const preview = useMemo(
        () =>
            convertPoints({
                originPoints: originPts,
                from: convFrom,
                to: convTo,
                bonusPercent: bonus
            }),
        [originPts, convFrom, convTo, bonus]
    );

    const feed = movements.filter(
        (m) => m.source !== 'clube_suppressed' && (!selectedId || m.programId === selectedId)
    );
    const missing = from ? Math.max(0, originPts - from.balance) : 0;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (tool !== 'log') {
                setTool('log');
                return;
            }
            if (!editor) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [editor, onClose, tool]);

    async function dropMove(m: Move) {
        const transfer = String(m.type).startsWith('transferencia');
        const ok = window.confirm(
            transfer
                ? 'Excluir esta transferência nos dois lados?'
                : `Excluir ${movementLabel(m.source === 'clube' ? 'clube' : m.type)} de ${formatPts(m.points)}?`
        );
        if (!ok) return;
        setError(null);
        setBusy(true);
        try {
            await deleteMilesMovement(m.id);
            await load();
            bump();
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    async function launch(e: FormEvent) {
        e.preventDefault();
        if (!selectedId || points <= 0) return;
        setError(null);
        setBusy(true);
        try {
            await postMilesMovement({
                type,
                programId: selectedId,
                points,
                amount: type === 'compra' && amount > 0 ? amount : null,
                currency: 'BRL',
                notes
            });
            setPoints(0);
            setAmount(0);
            setNotes('');
            await load();
            bump();
            setTool('log');
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    async function transfer(e: FormEvent) {
        e.preventDefault();
        if (!fromId || !toId || fromId === toId || originPts <= 0) return;
        setError(null);
        setBusy(true);
        try {
            await postMilesMovement({
                type: 'transferencia',
                fromProgramId: fromId,
                toProgramId: toId,
                originPoints: originPts,
                conversionFrom: convFrom,
                conversionTo: convTo,
                bonusPercent: bonus
            });
            setOriginPts(0);
            await load();
            bump();
            setTool('log');
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    async function saveWallet(draft: WalletDraft) {
        setError(null);
        setBusy(true);
        try {
            if (editor === 'create') {
                const created = (await createMilesProgram(draft)) as { program: { id: string } };
                const list = await load();
                if (created.program?.id) {
                    setSelectedId(created.program.id);
                    setFromId(created.program.id);
                    const other = list.find((p) => p.id !== created.program.id);
                    if (other) setToId(other.id);
                }
            } else if (selected) {
                await patchMilesProgram(selected.id, {
                    name: draft.name,
                    unit: draft.unit,
                    issuer: draft.issuer,
                    notes: draft.notes,
                    expiresOn: draft.expiresOn || null,
                    ...(draft.householdShared !== undefined
                        ? {
                              householdShared: draft.householdShared,
                              holderUserId: draft.holderUserId ?? undefined
                          }
                        : {})
                });
                if (draft.balance != null && draft.balance !== selected.balance) {
                    await setMilesBalance(selected.id, draft.balance);
                }
                await load();
            }
            setEditor(null);
            bump();
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    const rateHint =
        from && to && fromId !== toId
            ? rateSource === 'saved'
                ? `Taxa ${from.name} → ${to.name} já salva.`
                : rateSource === 'wallet'
                  ? `Bônus +${bonus}% da carteira ${from.name}.`
                  : `Sugerimos ${convFrom}:${convTo}; grava na transferência.`
            : undefined;

    function pickWallet(id: string) {
        setSelectedId(id);
        setFromId(id);
        const other = programs.find((p) => p.id !== id);
        if (other) setToId(other.id);
    }

    return (
        <div
            className="voos-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                if (tool !== 'log') {
                    setTool('log');
                    return;
                }
                if (!editor) onClose();
            }}
        >
            <div
                className={`voos-editor carteira-sheet pontos-wallet--${selected?.brand || 'outro'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="carteira-sheet-title"
            >
                <header className="voos-editor__head">
                    <div className="voos-editor__identity">
                        <p className="pontos-kicker">Carteira</p>
                        <h2 id="carteira-sheet-title">{selected?.name ?? 'Carteira'}</h2>
                        {selected ? (
                            <p className="carteira-sheet__meta">
                                {[selected.issuer, unitLabel(selected.unit || 'pontos', 2)]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                        ) : null}
                    </div>
                    <div className="voos-editor__head-actions">
                        {selected ? (
                            <button
                                type="button"
                                className="voos-icon-btn voos-icon-btn--oceano"
                                onClick={() => setEditor('edit')}
                                title="Editar carteira"
                                aria-label="Editar carteira"
                            >
                                <MaterialIcon name="edit" variant="app" opticalSize={18} />
                            </button>
                        ) : null}
                        <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                            <MaterialIcon name="close" variant="app" opticalSize={20} />
                        </button>
                    </div>
                </header>

                <PontosAlert>{error}</PontosAlert>

                {!ready ? (
                    <p className="voos-muted">Carregando carteira…</p>
                ) : selected ? (
                    <div className="carteira-sheet__body">
                        {programs.length > 1 ? (
                            <div className="carteira-sheet__switch" role="tablist" aria-label="Carteiras">
                                {programs.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={p.id === selectedId}
                                        className={p.id === selectedId ? 'is-on' : undefined}
                                        onClick={() => pickWallet(p.id)}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <section className="voos-editor__col carteira-sheet__saldo" aria-label="Saldo">
                            <p className="pontos-kicker">Saldo</p>
                            <p className="carteira-sheet__figure">
                                {formatPts(selected.balance)}
                                <small>{unitLabel(selected.unit || 'pontos', selected.balance || 2)}</small>
                            </p>
                            <div className="carteira-sheet__stats">
                                <div>
                                    <span>Livre</span>
                                    <strong>{formatPts(selected.available ?? selected.balance)}</strong>
                                </div>
                                <div>
                                    <span>Reservados</span>
                                    <strong>{formatPts(selected.committed ?? 0)}</strong>
                                </div>
                                <div>
                                    <span>Milheiro</span>
                                    <strong>
                                        {Number(selected.milheiro) > 0 ? formatBRL(Number(selected.milheiro)) : '—'}
                                    </strong>
                                </div>
                                <div>
                                    <span>Investido</span>
                                    <strong>{formatBRL(Number(selected.invested) || 0)}</strong>
                                </div>
                            </div>
                        </section>

                        <WalletBenefits
                            program={selected}
                            onSaved={(next) => {
                                setPrograms((list) => list.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
                                bump();
                                void load();
                            }}
                        />

                        <section className="voos-editor__col carteira-sheet__move" aria-label="Movimentações">
                            <div className="voos-editor__col-head">
                                <p className="pontos-kicker">Movimentações</p>
                                <div className="carteira-sheet__tools">
                                    <button
                                        type="button"
                                        className="voos-icon-btn voos-icon-btn--coral"
                                        onClick={() => setTool('lancar')}
                                        title="Lançar"
                                        aria-label="Lançar pontos"
                                    >
                                        <MaterialIcon name="add" variant="app" opticalSize={20} />
                                    </button>
                                    <button
                                        type="button"
                                        className="voos-icon-btn voos-icon-btn--oceano"
                                        onClick={() => setTool('transferir')}
                                        disabled={programs.length < 2}
                                        title={
                                            programs.length < 2
                                                ? 'Crie outra carteira para transferir'
                                                : 'Transferir'
                                        }
                                        aria-label="Transferir pontos"
                                    >
                                        <MaterialIcon name="swap_horiz" variant="app" opticalSize={20} />
                                    </button>
                                </div>
                            </div>

                            {feed.length === 0 ? (
                                <div className="carteira-log__empty">
                                    <MaterialIcon name="receipt_long" variant="app" opticalSize={22} />
                                    <p>Nenhum movimento ainda</p>
                                </div>
                            ) : (
                                <ul className="carteira-log">
                                    {feed.map((m) => {
                                        const debit = isDebit(m.type, m.pointsSign);
                                        const kind = String(m.type).startsWith('transferencia')
                                            ? 'fx'
                                            : debit
                                              ? 'out'
                                              : 'in';
                                        return (
                                            <li key={m.id}>
                                                <span className={`carteira-log__tag carteira-log__tag--${kind}`}>
                                                    {movementLabel(m.source === 'clube' ? 'clube' : m.type)}
                                                </span>
                                                <div className="carteira-log__copy">
                                                    {m.notes ? <strong>{m.notes}</strong> : null}
                                                    <em>
                                                        {dateLabel(m.occurredOn)}
                                                        {m.amountBrl ? ` · ${formatBRL(Number(m.amountBrl))}` : ''}
                                                    </em>
                                                </div>
                                                <b className={debit ? 'is-out' : 'is-in'}>
                                                    {debit ? '−' : '+'}
                                                    {formatPts(m.points)}
                                                </b>
                                                <button
                                                    type="button"
                                                    className="voos-icon-btn voos-icon-btn--coral carteira-log__drop"
                                                    title="Excluir lançamento"
                                                    aria-label="Excluir lançamento"
                                                    disabled={busy}
                                                    onClick={() => void dropMove(m)}
                                                >
                                                    <MaterialIcon name="delete" variant="app" opticalSize={16} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                ) : (
                    <p className="voos-muted">Crie uma carteira para lançar e transferir.</p>
                )}

                {editor ? (
                    <PontosWalletEditor
                        title={editor === 'create' ? 'Nova carteira' : `Editar ${selected?.name ?? 'carteira'}`}
                        initial={editor === 'edit' ? selected : undefined}
                        showBalance={editor === 'edit'}
                        balance={selected?.balance ?? 0}
                        busy={busy}
                        onClose={() => {
                            setEditor(null);
                            if (programId === 'create' && programs.length === 0) onClose();
                        }}
                        onSave={(draft) => void saveWallet(draft)}
                    />
                ) : null}

                {selected && tool === 'lancar' ? (
                    <div
                        className="carteira-pop-scrim"
                        onClick={() => setTool('log')}
                    >
                        <form
                            className="carteira-pop"
                            role="dialog"
                            aria-labelledby="carteira-pop-launch"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => void launch(e)}
                        >
                            <header>
                                <h3 id="carteira-pop-launch">Lançar</h3>
                                <button
                                    type="button"
                                    className="voos-icon-btn"
                                    onClick={() => setTool('log')}
                                    aria-label="Fechar"
                                >
                                    <MaterialIcon name="close" variant="app" opticalSize={18} />
                                </button>
                            </header>
                            <div className="voo-pay__mode" role="tablist" aria-label="Tipo de lançamento">
                                {LAUNCH_TYPES.map(([k, l]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        role="tab"
                                        aria-selected={type === k}
                                        className={type === k ? 'is-on' : undefined}
                                        onClick={() => setType(k)}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <div className="carteira-sheet__form-grid">
                                <PtsField
                                    label={unitLabel(selected.unit || 'pontos', 2)}
                                    value={points}
                                    onChange={setPoints}
                                />
                                {type === 'compra' ? (
                                    <DecimalField
                                        label="Quanto pagou"
                                        value={amount}
                                        onChange={setAmount}
                                        suffix="R$"
                                    />
                                ) : null}
                                <TextField
                                    label="Nota"
                                    value={notes}
                                    onChange={setNotes}
                                    placeholder="Cartão, clube, promoção…"
                                />
                            </div>
                            <button
                                type="submit"
                                className="viagens-btn viagens-btn--coral"
                                disabled={busy || points <= 0}
                            >
                                {busy ? 'Salvando…' : 'Lançar'}
                            </button>
                        </form>
                    </div>
                ) : null}

                {selected && tool === 'transferir' ? (
                    <div
                        className="carteira-pop-scrim"
                        onClick={() => setTool('log')}
                    >
                        <form
                            className="carteira-pop carteira-pop--fx"
                            role="dialog"
                            aria-labelledby="carteira-pop-fx"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => void transfer(e)}
                        >
                            <header>
                                <h3 id="carteira-pop-fx">Transferir</h3>
                                <button
                                    type="button"
                                    className="voos-icon-btn"
                                    onClick={() => setTool('log')}
                                    aria-label="Fechar"
                                >
                                    <MaterialIcon name="close" variant="app" opticalSize={18} />
                                </button>
                            </header>
                            <div className="carteira-pop__pair">
                                <SelectField label="Sai de" value={fromId} onChange={setFromId}>
                                    {programs.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} · {formatPts(p.balance)}
                                        </option>
                                    ))}
                                </SelectField>
                                <button
                                    type="button"
                                    className="voos-icon-btn voos-icon-btn--oceano"
                                    onClick={() => {
                                        setFromId(toId);
                                        setToId(fromId);
                                    }}
                                    aria-label="Inverter"
                                    title="Inverter"
                                >
                                    <MaterialIcon name="swap_horiz" variant="app" opticalSize={18} />
                                </button>
                                <SelectField label="Entra em" value={toId} onChange={setToId}>
                                    {programs.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </SelectField>
                            </div>
                            <PtsField
                                label={`${unitLabel(from?.unit || 'pontos', 2)} na origem`}
                                value={originPts}
                                onChange={setOriginPts}
                                hint={from ? `Saldo ${formatPts(from.balance)}` : undefined}
                            />
                            <p className="carteira-pop__preview">
                                {originPts > 0 ? (
                                    <>
                                        {formatPts(originPts)} → <strong>{formatPts(preview.total)}</strong>
                                        {preview.bonus > 0 ? ` · +${formatPts(preview.bonus)} bônus` : ''}
                                    </>
                                ) : (
                                    'Quanto sai da origem'
                                )}
                            </p>
                            <div className="carteira-sheet__fx">
                                <RatioBar
                                    from={convFrom}
                                    to={convTo}
                                    fromUnit={from?.unit}
                                    toUnit={to?.unit}
                                    hint={rateHint}
                                    onChange={(a, b) => {
                                        setConvFrom(a);
                                        setConvTo(b);
                                    }}
                                />
                                <BonusBar value={bonus} onChange={setBonus} />
                            </div>
                            {fromId === toId ? (
                                <p className="pontos-warn">Escolha duas carteiras diferentes.</p>
                            ) : missing > 0 && originPts > 0 ? (
                                <p className="pontos-warn">
                                    Faltam {formatPts(missing)} em {from?.name}.
                                </p>
                            ) : null}
                            <button
                                type="submit"
                                className="viagens-btn viagens-btn--coral"
                                disabled={busy || originPts <= 0 || fromId === toId}
                            >
                                {busy ? 'Transferindo…' : `Transferir · ${formatPts(preview.total)}`}
                            </button>
                        </form>
                    </div>
                ) : null}

            </div>
        </div>
    );
}

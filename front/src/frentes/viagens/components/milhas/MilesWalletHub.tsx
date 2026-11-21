import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { convertPoints } from '@motor/milhas/convert.js';
import { rateForPair, unitLabel } from '@motor/milhas/catalog.js';
import {
    createEmission,
    createMilesProgram,
    deleteMilesMovement,
    fetchEmissions,
    fetchMilesDashboard,
    fetchMilesMovements,
    fetchMilesPrograms,
    patchMilesProgram,
    postMilesMovement,
    setMilesBalance
} from '../../api/miles';
import { saldoEmReais, totalSaldoEmReais } from '../../domain/milhas-cmp';
import { formatBRL } from '../../utils/map-utils';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import {
    BonusBar,
    Chip,
    ChipRow,
    ConvertStage,
    DecimalField,
    PontosAlert,
    ProgramStrip,
    PtsField,
    RatioBar,
    Segmented,
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
    statusLabel,
    type ConversionRate,
    type MilesProgram
} from '../../pages/pontos/pontos-format';
import { ScreenLoader } from '../../../../components/ui/ScreenLoader';
import { MilhasCalculadorasPanel } from './MilhasCalculadorasPanel';
import { MilhasHubTabs, type MilhasHubPanel } from './MilhasHubTabs';
import { MilhasSpotlight } from './MilhasSpotlight';
import { MilhasSummaryCards } from './MilhasSummaryCards';
import { MilhasWalletRail } from './MilhasWalletRail';

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
    recordedByName?: string | null;
};

type Sim = { id: string; title: string; status: string };

type Props = {
    tripId?: string;
    showTripEmissions?: boolean;
    showGlobalKpis?: boolean;
    beforeHub?: ReactNode;
};

export function MilesWalletHub({ tripId, showTripEmissions, showGlobalKpis, beforeHub }: Props) {
    const navigate = useNavigate();
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [rates, setRates] = useState<ConversionRate[]>([]);
    const [movements, setMovements] = useState<Move[]>([]);
    const [sims, setSims] = useState<Sim[]>([]);
    const [programId, setProgramId] = useState('');
    const [tool, setTool] = useState('lancar');
    const [mainPanel, setMainPanel] = useState<MilhasHubPanel>('operar');
    const [hydrating, setHydrating] = useState(showGlobalKpis);
    const [type, setType] = useState('acumulo');
    const [points, setPoints] = useState(0);
    const [amount, setAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [originPts, setOriginPts] = useState(0);
    const [convFrom, setConvFrom] = useState(2);
    const [convTo, setConvTo] = useState(1);
    const [bonus, setBonus] = useState(0);
    const [rateSource, setRateSource] = useState<'saved' | 'suggested' | 'wallet'>('suggested');
    const [simTitle, setSimTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editor, setEditor] = useState<'create' | 'edit' | null>(null);

    const load = useCallback(async () => {
        const [p, m, d, e] = await Promise.all([
            fetchMilesPrograms(),
            fetchMilesMovements(),
            fetchMilesDashboard(tripId),
            tripId ? fetchEmissions(tripId) : Promise.resolve({ emissions: [] as Sim[] })
        ]);
        const extra = ((d as { programs?: MilesProgram[] }).programs ?? []) as MilesProgram[];
        const list = (p.programs ?? []).map((prog) => {
            const dash = extra.find((x) => x.id === prog.id);
            return dash ? { ...prog, ...dash } : prog;
        });
        setPrograms(list);
        setRates(p.rates ?? []);
        setMovements((m as { movements: Move[] }).movements ?? []);
        setSims((e as { emissions: Sim[] }).emissions ?? []);
        setProgramId((id) => id || list[0]?.id || '');
        setFromId((id) => id || list[0]?.id || '');
        setToId((id) => id || list[1]?.id || list[0]?.id || '');
        return list;
    }, [tripId]);

    useEffect(() => {
        if (showGlobalKpis) setHydrating(true);
        void load()
            .catch((err: unknown) => setError(milesError(err)))
            .finally(() => {
                if (showGlobalKpis) setHydrating(false);
            });
    }, [load, showGlobalKpis]);

    const selected = programs.find((p) => p.id === programId);
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
        // savedKey tracks the stored pair so a reload does not wipe an edit in progress
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

    const kpi = useMemo(() => {
        if (!showGlobalKpis) return null;
        const balance = programs.reduce((n, p) => n + (p.balance ?? 0), 0);
        const reserved = programs.reduce((n, p) => n + (p.committed ?? 0), 0);
        const free = programs.reduce((n, p) => n + (p.available ?? p.balance ?? 0), 0);
        let weightedMilheiro = 0;
        let weightPts = 0;
        for (const p of programs) {
            const mil = Number(p.milheiro);
            const pts = p.balance ?? 0;
            if (mil > 0 && pts > 0) {
                weightedMilheiro += mil * pts;
                weightPts += pts;
            }
        }
        const milheiroAvg = weightPts > 0 ? weightedMilheiro / weightPts : null;
        const saldoBrl = totalSaldoEmReais(programs);
        return { balance, reserved, free, milheiroAvg, saldoBrl, count: programs.length };
    }, [programs, showGlobalKpis]);

    const feed = movements.filter((m) => !programId || m.programId === programId);
    const missing = from ? Math.max(0, originPts - from.balance) : 0;

    function pickProgram(id: string) {
        setProgramId(id);
        setFromId(id);
        const other = programs.find((p) => p.id !== id);
        if (other && toId === id) setToId(other.id);
    }

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
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    async function launch(e: FormEvent) {
        e.preventDefault();
        if (!programId || points <= 0) return;
        setError(null);
        setBusy(true);
        try {
            await postMilesMovement({
                type,
                programId,
                points,
                amount: type === 'compra' && amount > 0 ? amount : null,
                currency: 'BRL',
                notes
            });
            setPoints(0);
            setAmount(0);
            setNotes('');
            await load();
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
                await load();
                if (created.program?.id) pickProgram(created.program.id);
            } else if (selected) {
                await patchMilesProgram(selected.id, {
                    name: draft.name,
                    unit: draft.unit,
                    issuer: draft.issuer,
                    notes: draft.notes,
                    expiresOn: draft.expiresOn || null,
                    holderUserId: draft.holderUserId ?? undefined
                });
                if (draft.balance != null && draft.balance !== selected.balance) {
                    await setMilesBalance(selected.id, draft.balance);
                }
                await load();
            }
            setEditor(null);
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    async function createSim(e: FormEvent) {
        e.preventDefault();
        if (!tripId || !simTitle.trim() || !fromId) return;
        const destId = toId === fromId ? programs.find((p) => p.id !== fromId)?.id ?? toId : toId;
        setError(null);
        setBusy(true);
        try {
            const { emission } = (await createEmission({
                tripId,
                title: simTitle.trim(),
                originProgramId: fromId,
                destinationProgramId: destId,
                conversionFrom: convFrom,
                conversionTo: convTo,
                bonusPercent: bonus,
                fxRate: 6.2,
                iofPercent: 3.5,
                spreadPercent: 2,
                buyMilheiro: Number(selected?.milheiro) > 0 ? Number(selected?.milheiro) : 14,
                options: []
            })) as { emission: { id: string } };
            navigate(`/viagens/${tripId}/transporte/voos/pontos/emissao/${emission.id}`);
        } catch (err) {
            setError(milesError(err));
        } finally {
            setBusy(false);
        }
    }

    const rateHint =
        from && to && fromId !== toId
            ? rateSource === 'saved'
                ? `Taxa desta rota (${from.name} → ${to.name}) já está salva. Qualquer ajuste grava de novo na próxima transferência.`
                : rateSource === 'wallet'
                  ? `Bônus +${bonus}% vem do cadastro da carteira ${from.name}.`
                  : `Ainda não há taxa salva para ${from.name} → ${to.name}. Sugerimos ${convFrom}:${convTo}; ela fica gravada quando você transferir.`
            : undefined;

    const formClass = showGlobalKpis ? 'milhas-pane milhas-pane--form' : 'pontos-sheet pontos-sheet--form';
    const feedClass = showGlobalKpis ? 'milhas-pane milhas-pane--feed' : 'pontos-sheet';
    const launchForm = (
        <form className={formClass} onSubmit={(e) => void launch(e)}>
            {!showGlobalKpis ? (
                <p className="pontos-kicker">Entrada ou saída em {selected?.name ?? 'carteira'}</p>
            ) : null}
            <ChipRow>
                {LAUNCH_TYPES.map(([k, l]) => (
                    <Chip key={k} on={type === k} onClick={() => setType(k)}>
                        {l}
                    </Chip>
                ))}
            </ChipRow>
            <PtsField label={unitLabel(selected?.unit || 'pontos', 2)} value={points} onChange={setPoints} />
            {type === 'compra' ? (
                <DecimalField label="Quanto pagou" value={amount} onChange={setAmount} suffix="R$" />
            ) : null}
            <TextField
                label="Nota (opcional)"
                value={notes}
                onChange={setNotes}
                placeholder="Cartão, clube, promoção…"
            />
            <button type="submit" className="pontos-btn-primary" disabled={busy || points <= 0}>
                {busy ? 'Salvando…' : 'Lançar'}
            </button>
        </form>
    );

    const transferForm = (
        <form className={formClass} onSubmit={(e) => void transfer(e)}>
            <ConvertStage
                from={from}
                to={to}
                originPts={originPts}
                base={preview.base}
                bonus={preview.bonus}
                total={preview.total}
                onSwap={() => {
                    setFromId(toId);
                    setToId(fromId);
                }}
            />
            <div className="pontos-form-grid">
                <SelectField label="Sai de" value={fromId} onChange={setFromId}>
                    {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name} · {formatPts(p.balance)} {unitLabel(p.unit || 'pontos', 2)}
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
                label={`${unitLabel(from?.unit || 'pontos', 2)} na origem`}
                value={originPts}
                onChange={setOriginPts}
                hint={from ? `Saldo: ${formatPts(from.balance)}` : undefined}
            />
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
            <div className="pontos-score">
                <div>
                    <span>Convertidos</span>
                    <strong>{formatPts(preview.base)}</strong>
                </div>
                <div>
                    <span>Bônus</span>
                    <strong>{formatPts(preview.bonus)}</strong>
                </div>
                <div className="pontos-score__total">
                    <span>Total em {to?.name ?? 'destino'}</span>
                    <strong>
                        {formatPts(preview.total)} {unitLabel(to?.unit || 'pontos', preview.total || 2)}
                    </strong>
                </div>
            </div>
            {fromId === toId ? (
                <p className="pontos-warn">Escolha duas carteiras diferentes.</p>
            ) : missing > 0 && originPts > 0 ? (
                <p className="pontos-warn">
                    Faltam {formatPts(missing)} em {from?.name}.
                </p>
            ) : originPts > 0 ? (
                <p className="pontos-ok">A taxa desta rota é gravada ao confirmar.</p>
            ) : (
                <p className="voos-muted">A taxa preenche sozinha; você pode ajustar antes de transferir.</p>
            )}
            <button
                type="submit"
                className="pontos-btn-primary"
                disabled={busy || originPts <= 0 || fromId === toId}
            >
                {busy
                    ? 'Transferindo…'
                    : `Transferir · ${to?.name ?? 'destino'} recebe ${formatPts(preview.total)}`}
            </button>
        </form>
    );

    const operateCore = (
        <>
            <Segmented
                value={tool}
                onChange={setTool}
                options={[
                    ['lancar', 'Lançar'],
                    ['transferir', 'Transferir']
                ]}
            />
            {tool === 'lancar' ? launchForm : null}
            {tool === 'transferir' ? transferForm : null}
        </>
    );

    const operateBlock = (
        <>
            {operateCore}
            {selected ? (
                <details className="milhas-details">
                    <summary>Benefícios, clube e bônus de transferência</summary>
                    <WalletBenefits
                        program={selected}
                        onSaved={(next) => {
                            setPrograms((list) => list.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
                            void load();
                        }}
                    />
                </details>
            ) : null}
        </>
    );

    const extratoBlock = (
        <section className={feedClass}>
            {!showGlobalKpis ? <h3>Extrato {selected ? `· ${selected.name}` : ''}</h3> : null}
            {feed.length === 0 ? (
                <p className="voos-muted">Nada lançado nesta carteira.</p>
            ) : (
                <ul className="pontos-feed">
                    {feed.map((m) => {
                        const debit = isDebit(m.type, m.pointsSign);
                        return (
                            <li key={m.id}>
                                <div>
                                    <strong>{movementLabel(m.source === 'clube' ? 'clube' : m.type)}</strong>
                                    {m.notes ? <span>{m.notes}</span> : null}
                                    <em>
                                        {dateLabel(m.occurredOn)}
                                        {m.amountBrl ? ` · ${formatBRL(Number(m.amountBrl))}` : ''}
                                        {m.recordedByName ? ` · ${m.recordedByName}` : ''}
                                    </em>
                                </div>
                                <b className={debit ? 'is-out' : 'is-in'}>
                                    {debit ? '−' : '+'}
                                    {formatPts(m.points)}
                                </b>
                                <button
                                    type="button"
                                    className="voos-icon-btn voos-icon-btn--coral"
                                    title="Excluir lançamento"
                                    aria-label="Excluir lançamento"
                                    disabled={busy}
                                    onClick={() => void dropMove(m)}
                                >
                                    <DeleteIcon size="sm" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );

    if (showGlobalKpis) {
        if (hydrating) {
            return (
                <div className="pontos-hub-wrap milhas-hub">
                    {beforeHub}
                    <ScreenLoader label="Carregando milhas" variant="inline" />
                </div>
            );
        }

        return (
            <div className="pontos-hub-wrap milhas-hub">
                {beforeHub}
                {kpi ? <MilhasSummaryCards kpi={kpi} /> : null}
                <PontosAlert>{error}</PontosAlert>
                <div className="milhas-casa-layout" aria-label="Central de milhas">
                    <main className="milhas-casa-main">
                        {selected ? <MilhasSpotlight program={selected} onEdit={() => setEditor('edit')} /> : null}
                        {!selected ? (
                            <div className="milhas-trail-empty milhas-casa__placeholder">
                                <MaterialIcon name="loyalty" variant="app" opticalSize={48} />
                                <p>Central de milhas</p>
                                <span className="voos-muted">Crie uma carteira no painel ao lado para começar.</span>
                            </div>
                        ) : (
                            <>
                                <MilhasHubTabs value={mainPanel} onChange={setMainPanel} />
                                <div
                                    className="milhas-canvas__body"
                                    id={`milhas-panel-${mainPanel}`}
                                    role="tabpanel"
                                    aria-labelledby={`milhas-tab-${mainPanel}`}
                                >
                                    {mainPanel === 'operar' ? operateBlock : null}
                                    {mainPanel === 'extrato' ? extratoBlock : null}
                                    {mainPanel === 'ferramentas' ? (
                                        <MilhasCalculadorasPanel
                                            programs={programs}
                                            rates={rates}
                                            originProgramId={programId || programs[0]?.id}
                                            embedded
                                        />
                                    ) : null}
                                </div>
                            </>
                        )}
                    </main>
                    <MilhasWalletRail
                        programs={programs}
                        selectedId={programId}
                        onSelect={pickProgram}
                        onCreate={() => setEditor('create')}
                    />
                </div>
                {editor ? (
                    <PontosWalletEditor
                        title={editor === 'create' ? 'Nova carteira' : `Editar ${selected?.name ?? 'carteira'}`}
                        initial={editor === 'edit' ? selected : undefined}
                        showBalance={editor === 'edit'}
                        balance={selected?.balance ?? 0}
                        busy={busy}
                        onClose={() => setEditor(null)}
                        onSave={(draft) => void saveWallet(draft)}
                    />
                ) : null}
            </div>
        );
    }

    return (
        <div className="pontos-hub-wrap">
            {beforeHub}
            {kpi ? <MilhasSummaryCards kpi={kpi} /> : null}
        <div className="pontos-hub">
            <PontosAlert>{error}</PontosAlert>
            <aside className="pontos-hub__rail">
                <header className="pontos-module__head">
                    <div>
                        <p className="pontos-kicker">Carteiras</p>
                        <h2>Saldos</h2>
                    </div>
                    <button type="button" className="pontos-icon-add" onClick={() => setEditor('create')}>
                        <MaterialIcon name="add" variant="app" />
                        Nova
                    </button>
                </header>
                <ProgramStrip programs={programs} selectedId={programId} onSelect={pickProgram} />
            </aside>

            <div className="pontos-hub__main">
                {selected ? (
                    <section className="pontos-hero-card">
                        <div className="pontos-hero-card__top">
                            <div>
                                <p className="pontos-kicker">{unitLabel(selected.unit || 'pontos', 2)}</p>
                                <h2>{selected.name}</h2>
                                <p>
                                    {[
                                        selected.householdId ? 'Compartilhada na casa' : null,
                                        selected.holderUserName ? `Titular: ${selected.holderUserName}` : null,
                                        selected.issuer,
                                        selected.expiresOn ? `val. ${dateLabel(selected.expiresOn)}` : null
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || 'Carteira da conta'}
                                </p>
                            </div>
                            <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => setEditor('edit')}>
                                Editar
                            </button>
                        </div>
                        <p className="pontos-hero-card__saldo">
                            {formatPts(selected.balance)}
                            <small>{unitLabel(selected.unit || 'pontos', selected.balance || 2)}</small>
                        </p>
                        <div className="pontos-selected">
                            <div>
                                <span>Livre</span>
                                <strong>{formatPts(selected.available ?? selected.balance)}</strong>
                            </div>
                            <div>
                                <span>Reservados</span>
                                <strong>{formatPts(selected.committed ?? 0)}</strong>
                            </div>
                            <div>
                                <span>Milheiro médio</span>
                                <strong>
                                    {Number(selected.milheiro) > 0 ? formatBRL(Number(selected.milheiro)) : '—'}
                                </strong>
                            </div>
                            <div>
                                <span>Investido</span>
                                <strong>{formatBRL(Number(selected.invested) || 0)}</strong>
                            </div>
                            {(() => {
                                const saldoBrlSel = saldoEmReais(selected);
                                return (
                                    <div>
                                        <span>Saldo em R$</span>
                                        <strong>{saldoBrlSel != null ? formatBRL(saldoBrlSel) : '—'}</strong>
                                    </div>
                                );
                            })()}
                        </div>
                        {selected.notes ? <p className="pontos-hero-card__notes">{selected.notes}</p> : null}
                        <WalletBenefits
                            program={selected}
                            onSaved={(next) => {
                                setPrograms((list) => list.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
                                void load();
                            }}
                        />
                    </section>
                ) : (
                    <p className="voos-muted">Crie a primeira carteira para começar.</p>
                )}

                {operateCore}
                {extratoBlock}

                {showTripEmissions && tripId ? (
                    <section className="pontos-module">
                        <header className="pontos-module__head">
                            <div>
                                <p className="pontos-kicker">Nesta viagem</p>
                                <h2>Emissões</h2>
                            </div>
                        </header>
                        <form className="pontos-sheet pontos-sheet--form" onSubmit={(e) => void createSim(e)}>
                            <TextField
                                label="Nova simulação"
                                value={simTitle}
                                onChange={setSimTitle}
                                placeholder="Recife → Madri — abril/2027"
                            />
                            <button
                                type="submit"
                                className="viagens-btn viagens-btn--ghost"
                                disabled={busy || !simTitle.trim()}
                            >
                                {busy ? 'Criando…' : 'Abrir comparador'}
                            </button>
                        </form>
                        {sims.length === 0 ? (
                            <p className="voos-muted">Nenhuma simulação de emissão nesta viagem.</p>
                        ) : (
                            <ul className="pontos-sim-list">
                                {sims.map((s) => (
                                    <li key={s.id}>
                                        <Link to={`/viagens/${tripId}/transporte/voos/pontos/emissao/${s.id}`}>
                                            <strong>{s.title}</strong>
                                            <span className={`pontos-status pontos-status--${s.status}`}>
                                                {statusLabel(s.status)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}
            </div>

            {editor ? (
                <PontosWalletEditor
                    title={editor === 'create' ? 'Nova carteira' : `Editar ${selected?.name ?? 'carteira'}`}
                    initial={editor === 'edit' ? selected : undefined}
                    showBalance={editor === 'edit'}
                    balance={selected?.balance ?? 0}
                    busy={busy}
                    onClose={() => setEditor(null)}
                    onSave={(draft) => void saveWallet(draft)}
                />
            ) : null}

        </div>
        </div>
    );
}

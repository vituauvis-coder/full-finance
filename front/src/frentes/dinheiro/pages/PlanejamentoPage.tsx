import { useCallback, useEffect, useMemo, useState } from 'react';
import { CivilPeriodTimeline } from '../../../components/finance/CivilPeriodTimeline';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { defaultCivilYear, defaultPeriod, monthIndexFromPeriod } from '../../../lib/period';
import { filterMovementsInPeriod } from '../../../lib/movementList';
import { apiFetch } from '../../../lib/http';
import { ZeroBudgetBlockForm } from '../components/ZeroBudgetBlockForm';
import { ZeroBudgetBlockTodos } from '../components/ZeroBudgetBlockTodos';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

type ZeroBudgetBlock = {
    id: string;
    name: string;
    categoryName?: string;
    color?: string;
    allocatedAmount?: number;
};

export function PlanejamentoPage() {
    const { data, loading, error } = useFinanceData();
    const [period, setPeriod] = useState(defaultPeriod);
    const [year, setYear] = useState(defaultCivilYear);
    const [blocks, setBlocks] = useState<ZeroBudgetBlock[]>([]);
    const [blocksError, setBlocksError] = useState<string | null>(null);
    const [openBlockId, setOpenBlockId] = useState<string | null>(null);
    const currency = data?.userProfile?.currency ?? 'BRL';
    const month = monthIndexFromPeriod(period) + 1;

    const loadBlocks = useCallback(async () => {
        setBlocksError(null);
        try {
            const r = await apiFetch<{ blocks: ZeroBudgetBlock[] }>(`/api/zero-budget?month=${month}&year=${year}`);
            setBlocks(r.blocks ?? []);
        } catch (e) {
            setBlocks([]);
            setBlocksError(e instanceof Error ? e.message : 'Erro ao carregar blocos');
        }
    }, [month, year]);

    useEffect(() => {
        void loadBlocks();
    }, [loadBlocks]);

    const snapshot = useMemo(() => {
        if (!data) return { income: 0, expense: 0, delta: 0 };
        const gains = filterMovementsInPeriod(data.userGains, period, year);
        const expenses = filterMovementsInPeriod(data.userExpenses, period, year);
        const income = gains.reduce((s, g) => s + (Number(g.amount) || 0), 0);
        const expense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        return { income, expense, delta: income - expense };
    }, [data, period, year]);

    const allocated = blocks.reduce((s, b) => s + (Number(b.allocatedAmount) || 0), 0);

    if (loading) {
        return (
            <section className="page active zero-budget-page">
                <ScreenLoader label="Carregando planejamento" />
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="page active zero-budget-page">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    return (
        <section id="zero-budget-page" className="page active zero-budget-page" aria-label="Planejamento Base Zero">
            <CivilPeriodTimeline
                period={period}
                year={year}
                onPeriodChange={setPeriod}
                onYearChange={setYear}
                className="civil-period-timeline--zero-budget"
            />
            <div className="zero-budget">
                <div className="summary-cards movements-summary">
                    <article className="summary-card summary-card--income">
                        <h3 className="summary-card__title">A alocar (entradas)</h3>
                        <p className="summary-card__value">{formatBRL(snapshot.income, currency)}</p>
                    </article>
                    <article className="summary-card summary-card--expense">
                        <h3 className="summary-card__title">Gasto real (saídas)</h3>
                        <p className="summary-card__value">{formatBRL(snapshot.expense, currency)}</p>
                    </article>
                    <article className="summary-card summary-card--projection">
                        <h3 className="summary-card__title">Alocado em blocos</h3>
                        <p className="summary-card__value">{formatBRL(allocated, currency)}</p>
                    </article>
                    <article className="summary-card summary-card--balance">
                        <h3 className="summary-card__title">Restante</h3>
                        <p className="summary-card__value">{formatBRL(snapshot.delta, currency)}</p>
                    </article>
                </div>
                {blocksError ? <p role="alert">{blocksError}</p> : null}
                <ZeroBudgetBlockForm month={month} year={year} onCreated={loadBlocks} />
                <section className="zero-budget-blocks" aria-label="Blocos de orçamento">
                    {blocks.length === 0 ? (
                        <p className="card-metric-hint">Nenhum bloco para este mês. Crie blocos no legado ou via POST /api/zero-budget/blocks.</p>
                    ) : (
                        <ul className="zero-budget-blocks-list">
                            {blocks.map((b) => (
                                <li key={b.id} className="zero-budget-block-card">
                                    <button
                                        type="button"
                                        className="zero-budget-block-card__toggle"
                                        onClick={() => setOpenBlockId(openBlockId === b.id ? null : b.id)}
                                    >
                                        <span className={b.color || 'zero-budget-block-color'} aria-hidden="true"></span>
                                        <strong>{b.categoryName || b.name}</strong>
                                        <span>{formatBRL(Number(b.allocatedAmount) || 0, currency)}</span>
                                    </button>
                                    <span style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button
                                            type="button"
                                            className="btn-secondary btn-small"
                                            onClick={async () => {
                                                const next = window.prompt('Novo valor alocado', String(b.allocatedAmount ?? 0));
                                                if (next == null) return;
                                                const allocatedAmount = parseFloat(next);
                                                if (!Number.isFinite(allocatedAmount)) return;
                                                await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(b.id)}`, {
                                                    method: 'PUT',
                                                    body: JSON.stringify({ allocatedAmount })
                                                });
                                                await loadBlocks();
                                            }}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary btn-small"
                                            onClick={async () => {
                                                if (!window.confirm('Excluir este bloco?')) return;
                                                await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(b.id)}`, {
                                                    method: 'DELETE'
                                                });
                                                await loadBlocks();
                                            }}
                                        >
                                            Excluir
                                        </button>
                                    </span>
                                    {openBlockId === b.id ? <ZeroBudgetBlockTodos blockId={b.id} currency={currency} /> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </section>
    );
}
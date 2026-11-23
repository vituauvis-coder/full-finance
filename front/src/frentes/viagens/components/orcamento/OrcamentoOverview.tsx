import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import type { buildOrcamentoSnapshot } from './orcamento-model';
import { depositsByMonthKey, monthShortPt } from './orcamento-model';
import { OrcamentoGoalDonut } from './OrcamentoGoalDonut';
import { OrcamentoPaymentDonut } from './OrcamentoPaymentDonut';

type Snap = ReturnType<typeof buildOrcamentoSnapshot>;

type Props = {
    snap: Snap;
    metaEdit: boolean;
    displayGoal: number;
    goalFromCaps: boolean;
    manualGoal: number;
    onStartMetaEdit: () => void;
    onGoalInput: (value: number) => void;
    onCancelMetaEdit: () => void;
    onOpenHistory: () => void;
    onOpenAporte: () => void;
};

export function OrcamentoOverview({
    snap,
    metaEdit,
    displayGoal: _displayGoal,
    goalFromCaps,
    manualGoal,
    onStartMetaEdit,
    onGoalInput,
    onCancelMetaEdit,
    onOpenHistory,
    onOpenAporte
}: Props) {
    const depositsByMonth = depositsByMonthKey(snap.deposits);

    return (
        <section className="orc-overview" aria-label="Panorama da meta">
            <article className="orc-overview__block orc-overview__block--chart" aria-label="Gráfico da meta">
                <div className="orc-chart-toolbar">
                    {metaEdit ? (
                        <input
                            type="number"
                            className="orc-chart-toolbar__input"
                            min={0}
                            autoFocus
                            defaultValue={manualGoal || ''}
                            onBlur={(e) => onGoalInput(Number(e.target.value) || 0)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') onCancelMetaEdit();
                            }}
                        />
                    ) : null}
                    {goalFromCaps ? (
                        <span className="orc-chart-toolbar__hint" title="Soma dos tetos">
                            <MaterialIcon name="layers" variant="app" opticalSize={14} aria-hidden />
                        </span>
                    ) : null}
                    <button type="button" className="orc-chart-toolbar__edit" aria-label="Editar meta" onClick={onStartMetaEdit}>
                        <MaterialIcon name="edit" variant="app" opticalSize={15} />
                    </button>
                </div>
                <OrcamentoGoalDonut
                    effectiveGoal={snap.effectiveGoal}
                    cofrinhoRemaining={snap.cofrinhoRemaining}
                    cofrinhoUsed={snap.cofrinhoUsed}
                    stillToSave={snap.stillToSave}
                />
            </article>

            <article className="orc-overview__block orc-overview__block--aportes" aria-label="Cofrinho e aportes">
                <div className="orc-aportes__top">
                    <span className="orc-aportes__eyebrow">Cofrinho</span>
                    <div className="orc-aportes__tools">
                        <button type="button" className="orc-aportes__icon" onClick={onOpenHistory} aria-label="Histórico">
                            <MaterialIcon name="history" variant="app" opticalSize={17} />
                        </button>
                        <button type="button" className="orc-aportes__aportar" onClick={onOpenAporte}>
                            <MaterialIcon name="add" variant="app" opticalSize={15} />
                            Aportar
                        </button>
                    </div>
                </div>
                <strong
                    className="orc-aportes__balance"
                    title="Total aportado no cofrinho (+ rendimento, se houver). Uso do saldo: gráfico e «usados»."
                >
                    {formatBRL(snap.cofrinhoAportesTotal)}
                </strong>
                <span className="orc-aportes__count">
                    {snap.depositCount} {snap.depositCount === 1 ? 'aporte' : 'aportes'}
                    {snap.cofrinhoRendimento > 0 ? <> · +{formatBRL(snap.cofrinhoRendimento)} rend.</> : null}
                    {snap.cofrinhoUsed > 0 ? (
                        <>
                            {' '}
                            · {formatBRL(snap.cofrinhoUsed)} usados
                        </>
                    ) : null}
                </span>

                <ul className="orc-aportes__pace" aria-label="Ritmo de aportes">
                    <li>
                        <em>Por mês</em>
                        <strong>{snap.monthlyNeed != null ? formatBRL(snap.monthlyNeed) : '—'}</strong>
                    </li>
                    <li>
                        <em>Meses</em>
                        <strong>{snap.pace.monthsLeft > 0 ? snap.pace.monthsLeft : '—'}</strong>
                    </li>
                    <li>
                        <em>Este mês</em>
                        <strong className="is-turquesa">{formatBRL(snap.currentMonthTotal)}</strong>
                    </li>
                </ul>

                <PaceMonthCalendar snap={snap} depositsByMonth={depositsByMonth} />

            </article>

            <article className="orc-overview__block orc-overview__block--categories" aria-label="Gastos por forma de pagamento">
                <OrcamentoPaymentDonut
                    total={snap.spentTotal}
                    pixPaid={snap.expensePay.pixPaid}
                    cardSingle={snap.expensePay.cardSingle ?? 0}
                    cardInstallmentTotal={snap.expensePay.cardInstallmentTotal ?? 0}
                    cardInstallmentMonthly={snap.expensePay.cardInstallmentMonthly}
                />
            </article>
        </section>
    );
}

function PaceMonthCalendar({
    snap,
    depositsByMonth
}: {
    snap: Snap;
    depositsByMonth: Record<string, number>;
}) {
    if (snap.pace.remainingMonthKeys.length === 0) return null;

    const keys = snap.pace.remainingMonthKeys;
    return (
        <div className="orc-month-cal orc-month-cal--aportes" aria-label="Meses até a viagem">
            {keys.map((key) => {
                const deposited = depositsByMonth[key] ?? 0;
                const isCurrent = key === snap.pace.currentMonthKey;
                const isTrip = key === snap.pace.tripMonthKey;
                const target = snap.monthlyNeed;
                const hit = target != null && target > 0 && deposited >= target - 0.01;
                return (
                    <div
                        key={key}
                        className={`orc-month-cal__cell${isCurrent ? ' is-current' : ''}${isTrip ? ' is-trip' : ''}${hit ? ' is-hit' : ''}${deposited > 0 ? ' has-deposit' : ''}`}
                    >
                        <span className="orc-month-cal__month">{monthShortPt(key)}</span>
                        <strong className="orc-month-cal__dep">{deposited > 0 ? formatBRL(deposited) : '—'}</strong>
                        {isTrip ? <span className="orc-month-cal__pin" aria-hidden /> : null}
                    </div>
                );
            })}
        </div>
    );
}
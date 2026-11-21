import { sortDebtsForDisplay } from '../../domain/debtColors';
import type { DebtColorKey } from '../../domain/debtColors';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { DebtGoalCard } from './DebtGoalCard';

type Props = {
    debts: Debt[];
    updates: DebtUpdate[];
    currency: string;
    onRegister: (debtId: string) => void;
    onSettings: (debtId: string) => void;
    onColorChange: (debtId: string, colorKey: DebtColorKey) => void | Promise<void>;
    onRequestCreate: () => void;
};

export function DebtsCardsGrid({
    debts,
    updates,
    currency,
    onRegister,
    onSettings,
    onColorChange,
    onRequestCreate
}: Props) {
    const items = sortDebtsForDisplay(debts);

    if (!items.length) {
        return (
            <section className="zero-budget__blocks-section" aria-label="Dívidas por banco">
                <div id="debts-goal-cards" className="zero-budget__blocks-grid">
                    <div className="zero-budget__empty goals-empty-state">
                        <div className="goals-empty-state__icon" aria-hidden="true">
                            <i className="fas fa-landmark"></i>
                        </div>
                        <p className="goals-empty-state__title">Nenhuma dívida cadastrada</p>
                        <p className="goals-empty-state__text zero-budget__empty-hint">
                            Use «Nova dívida» no topo para registrar seu primeiro banco ou instituição.
                        </p>
                        <button type="button" className="btn-primary" onClick={onRequestCreate}>
                            Nova dívida
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="zero-budget__blocks-section" aria-label="Dívidas por banco">
            <div id="debts-goal-cards" className="zero-budget__blocks-grid">
                {items.map((d) => (
                    <DebtGoalCard
                        key={d.id}
                        debt={d}
                        updates={updates}
                        currency={currency}
                        onRegister={onRegister}
                        onSettings={onSettings}
                        onColorChange={onColorChange}
                    />
                ))}
            </div>
        </section>
    );
}
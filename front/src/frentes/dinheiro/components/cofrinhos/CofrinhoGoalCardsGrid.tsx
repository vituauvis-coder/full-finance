import type { CofrinhoApplication, CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import type { Movement } from '../../../../lib/types/finance';
import { CofrinhoBucketCard } from './CofrinhoBucketCard';

type Props = {
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    goals: CofrinhoBucketGoal[];
    currency: string;
    goalYear: number;
    onEdit: (bucket: CofrinhoBucket) => void;
    onAllocate: (bucketId: string) => void;
    onRefresh: () => Promise<void>;
};

export function CofrinhoGoalCardsGrid({
    buckets,
    applications,
    expenses,
    goals,
    currency,
    goalYear,
    onEdit,
    onAllocate,
    onRefresh
}: Props) {
    if (buckets.length === 0) {
        return (
            <section className="zero-budget__blocks-section cofrinhos-page__section" aria-label="Caixinhas">
                <div className="goals-empty-state zero-budget__empty">
                    <div className="goals-empty-state__icon" aria-hidden="true">
                        <i className="fas fa-boxes-stacked"></i>
                    </div>
                    <p className="goals-empty-state__title">Nenhuma caixinha</p>
                    <p className="goals-empty-state__text zero-budget__empty-hint">
                        Use «Nova» no topo para criar a primeira caixinha.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="zero-budget__blocks-section cofrinhos-page__section" aria-label="Caixinhas">
            <div id="cofrinhos-goal-cards" className="zero-budget__blocks-grid">
                {buckets.map((b) => (
                    <CofrinhoBucketCard
                        key={b.id}
                        bucket={b}
                        applications={applications}
                        expenses={expenses}
                        goals={goals}
                        currency={currency}
                        goalYear={goalYear}
                        onEdit={onEdit}
                        onAllocate={onAllocate}
                        onRefresh={onRefresh}
                    />
                ))}
            </div>
        </section>
    );
}
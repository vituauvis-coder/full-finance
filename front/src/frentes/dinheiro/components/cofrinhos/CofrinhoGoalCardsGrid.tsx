import { Fragment } from 'react';
import type { CofrinhoApplication, CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import type { Movement } from '../../../../lib/types/finance';
import { groupCofrinhoBucketsForDisplay } from '../../domain/cofrinhoBucketGroups';
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
    onOpenHistory: (bucket: CofrinhoBucket) => void;
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
    onOpenHistory
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

    const sections = groupCofrinhoBucketsForDisplay(buckets);

    return (
        <section className="zero-budget__blocks-section cofrinhos-page__section" aria-label="Caixinhas">
            <div className="cofrinhos-buckets-table" role="table" id="cofrinhos-goal-cards" aria-label="Caixinhas">
                <div className="cofrinhos-buckets-table__header" role="row">
                    <span role="columnheader">Caixinha</span>
                    <span role="columnheader">Valor</span>
                    <span role="columnheader">Meta</span>
                    <span role="columnheader">Progresso</span>
                    <span className="cofrinhos-buckets-table__th-actions" role="columnheader">
                        Ação
                    </span>
                </div>
                <ul className="cofrinhos-buckets-table__body" role="rowgroup">
                    {sections.map((section) => (
                        <Fragment key={section.id}>
                            <li
                                id={section.id === 'viagem' ? 'cofrinhos-goal-cards-viagens' : undefined}
                                className="cofrinhos-buckets-table__category"
                                role="row"
                                aria-label={section.title}
                            >
                                <div className="cofrinhos-buckets-table__category-inner" role="rowheader">
                                    <span className="cofrinhos-buckets-table__category-title">{section.title}</span>
                                    <span className="cofrinhos-buckets-table__category-count" aria-hidden="true">
                                        {section.buckets.length}
                                    </span>
                                </div>
                            </li>
                            {section.buckets.map((b) => (
                                <CofrinhoBucketCard
                                    key={b.id}
                                    bucket={b}
                                    buckets={buckets}
                                    applications={applications}
                                    expenses={expenses}
                                    goals={goals}
                                    currency={currency}
                                    goalYear={goalYear}
                                    onEdit={onEdit}
                                    onAllocate={onAllocate}
                                    onOpenHistory={onOpenHistory}
                                />
                            ))}
                        </Fragment>
                    ))}
                </ul>
            </div>
        </section>
    );
}
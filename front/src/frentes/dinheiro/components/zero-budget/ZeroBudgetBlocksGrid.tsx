import type { ZeroBudgetBlock } from '../../domain/zeroBudgetTypes';
import { ZeroBudgetBlockCard } from '../ZeroBudgetBlockCard';
import { ZeroBudgetEmptyState } from './ZeroBudgetEmptyState';

type Props = {
    blocks: ZeroBudgetBlock[];
    availableBalance: number;
    currency: string;
    isRefreshing?: boolean;
    onBlocksChange: () => void | Promise<void>;
    onAllocationPreview: (blockId: string, value: number) => void;
    onAllocationPreviewClear: (blockId: string) => void;
    onOpenTodos: (blockId: string) => void;
};

export function ZeroBudgetBlocksGrid({
    blocks,
    availableBalance,
    currency,
    isRefreshing = false,
    onBlocksChange,
    onAllocationPreview,
    onAllocationPreviewClear,
    onOpenTodos
}: Props) {
    if (blocks.length === 0) {
        return (
            <section className="zero-budget__blocks-section" aria-label="Blocos de orçamento">
                <div className="zero-budget__blocks-grid" data-zb-blocks>
                    <ZeroBudgetEmptyState />
                </div>
            </section>
        );
    }

    return (
        <section
            className={`zero-budget__blocks-section${isRefreshing ? ' zero-budget__blocks-section--refreshing' : ''}`}
            aria-label="Blocos de orçamento"
            aria-busy={isRefreshing}
        >
            <div className="zero-budget__blocks-grid" data-zb-blocks>
            {blocks.map((block) => (
                <ZeroBudgetBlockCard
                    key={block.id}
                    block={block}
                    blocks={blocks}
                    availableBalance={availableBalance}
                    currency={currency}
                    onChange={onBlocksChange}
                    onAllocationPreview={(value) => onAllocationPreview(block.id, value)}
                    onAllocationPreviewClear={() => onAllocationPreviewClear(block.id)}
                    onOpenTodos={onOpenTodos}
                />
            ))}
            </div>
        </section>
    );
}
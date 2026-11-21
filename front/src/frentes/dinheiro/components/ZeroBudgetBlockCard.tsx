import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { formatBRL } from '../../../lib/format';
import { getColorHex } from '../domain/zeroBudgetColors';
import { blockCategoryName, calcMaxAllocation } from '../domain/zeroBudgetPlanning';
import type { ZeroBudgetBlock } from '../domain/zeroBudgetTypes';
import { useZeroBudgetBlockMutations } from '../hooks/useZeroBudgetBlockMutations';
import { ZeroBudgetAllocationSlider } from './zero-budget/ZeroBudgetAllocationSlider';
import { ZeroBudgetBlockAmountField } from './zero-budget/ZeroBudgetBlockAmountField';
import { ZeroBudgetBlockCardFooter } from './zero-budget/ZeroBudgetBlockCardFooter';
import { ZeroBudgetBlockCardHeader } from './zero-budget/ZeroBudgetBlockCardHeader';
import { useBlockCardOpenTodos } from './zero-budget/useBlockCardOpenTodos';

type Props = {
    block: ZeroBudgetBlock;
    blocks: ZeroBudgetBlock[];
    availableBalance: number;
    currency: string;
    onChange: () => void | Promise<void>;
    onAllocationPreview: (value: number) => void;
    onAllocationPreviewClear: () => void;
    onOpenTodos: (blockId: string) => void;
};

export function ZeroBudgetBlockCard({
    block,
    blocks,
    availableBalance,
    currency,
    onChange,
    onAllocationPreview,
    onAllocationPreviewClear,
    onOpenTodos
}: Props) {
    const catName = blockCategoryName(block);
    const colorHex = getColorHex(block.color);
    const serverAllocated = Number(block.allocatedAmount) || 0;
    const [displayAllocated, setDisplayAllocated] = useState(serverAllocated);

    useEffect(() => {
        setDisplayAllocated(serverAllocated);
    }, [block.id, serverAllocated]);

    const maxAllocation = useMemo(
        () => calcMaxAllocation(availableBalance, blocks, block.id, displayAllocated),
        [availableBalance, blocks, block.id, displayAllocated]
    );

    const fillPct = useMemo(() => {
        if (maxAllocation <= 0) return 0;
        return Math.min(100, Math.round((displayAllocated / maxAllocation) * 100));
    }, [displayAllocated, maxAllocation]);

    const { patch, remove } = useZeroBudgetBlockMutations(block.id, onChange);

    const persistAmount = useCallback(
        async (next: number) => {
            const v = Math.min(Math.max(0, next), maxAllocation);
            const rounded = Math.round(v * 100) / 100;
            setDisplayAllocated(rounded);
            onAllocationPreview(rounded);
            try {
                await patch({ allocatedAmount: rounded });
            } finally {
                onAllocationPreviewClear();
            }
        },
        [maxAllocation, onAllocationPreview, onAllocationPreviewClear, patch]
    );

    const previewAmount = useCallback(
        (value: number) => {
            setDisplayAllocated(value);
            onAllocationPreview(value);
        },
        [onAllocationPreview]
    );

    const onDelete = useCallback(async () => {
        if (!window.confirm('Tem certeza que deseja excluir este bloco?')) return;
        await remove();
    }, [remove]);

    const openTodos = useCallback(() => onOpenTodos(block.id), [block.id, onOpenTodos]);
    const { onCardClick, onCardKey } = useBlockCardOpenTodos(openTodos);

    const onOpenList = useCallback(
        (e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            openTodos();
        },
        [openTodos]
    );

    return (
        <article
            className="zero-budget__block-card"
            data-zb-block-id={block.id}
            style={{ ['--zb-accent' as string]: colorHex }}
            onClick={onCardClick}
            onKeyDown={onCardKey}
            tabIndex={0}
            role="button"
            aria-label={`Bloco ${catName || '—'}. Clique para lista de compras.`}
        >
            <ZeroBudgetBlockCardHeader categoryName={catName} colorHex={colorHex} onDelete={onDelete} />
            <ZeroBudgetBlockAmountField
                blockId={block.id}
                allocated={displayAllocated}
                currency={currency}
                maxAllocation={maxAllocation}
                onCommit={persistAmount}
            />
            <ZeroBudgetAllocationSlider
                categoryName={catName}
                allocated={displayAllocated}
                maxAllocation={maxAllocation}
                colorHex={colorHex}
                onPreview={previewAmount}
                onCommit={persistAmount}
            />
            <p className="zero-budget__block-slider-meta">
                <span>{fillPct}% do teto</span>
                <span aria-hidden="true">·</span>
                <span>Máx. {formatBRL(maxAllocation, currency)}</span>
            </p>
            <ZeroBudgetBlockCardFooter
                categoryName={catName}
                selectedColor={block.color}
                onColorSelect={(colorClass) => patch({ color: colorClass })}
                onOpenList={onOpenList}
            />
        </article>
    );
}
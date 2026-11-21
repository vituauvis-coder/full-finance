import { useCallback, useEffect, useState } from 'react';
import { RangeControl } from '../../../../components/ui/RangeControl';

type Props = {
    categoryName: string;
    allocated: number;
    maxAllocation: number;
    colorHex: string;
    onPreview: (value: number) => void;
    onCommit: (value: number) => void | Promise<void>;
};

function roundMoney(n: number) {
    return Math.round(n * 100) / 100;
}

export function ZeroBudgetAllocationSlider({
    categoryName,
    allocated,
    maxAllocation,
    colorHex,
    onPreview,
    onCommit
}: Props) {
    const [draft, setDraft] = useState(allocated);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!isDragging) setDraft(allocated);
    }, [allocated, isDragging]);

    const clamp = useCallback(
        (next: number) => {
            const v = Math.min(Math.max(0, next), maxAllocation);
            return roundMoney(v);
        },
        [maxAllocation]
    );

    const handlePreview = useCallback(
        (next: number) => {
            const v = clamp(next);
            setDraft(v);
            onPreview(v);
        },
        [clamp, onPreview]
    );

    const handleCommit = useCallback(
        (next: number) => {
            setIsDragging(false);
            const v = clamp(next);
            setDraft(v);
            onPreview(v);
            void onCommit(v);
        },
        [clamp, onCommit, onPreview]
    );

    return (
        <div className="zero-budget__block-body zero-budget__block-body--range">
            <RangeControl
                min={0}
                max={maxAllocation}
                step={0.01}
                value={draft}
                accentColor={colorHex}
                ariaLabel={`Alocação para ${categoryName}`}
                disabled={maxAllocation <= 0}
                onValueChange={handlePreview}
                onCommit={handleCommit}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    setIsDragging(true);
                }}
            />
        </div>
    );
}
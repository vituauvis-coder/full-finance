import { type KeyboardEvent, type MouseEvent, useCallback } from 'react';

const INTERACTIVE_SELECTOR =
    'button, input, textarea, select, [data-zb-block-colors], [data-zb-amount-wrap], [data-zb-range], .zero-budget__colors-list, .zero-budget__block-list-btn';

export function useBlockCardOpenTodos(onOpenTodos: () => void) {
    const onCardClick = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            const interactive = (e.target as HTMLElement).closest(INTERACTIVE_SELECTOR);
            if (interactive) return;
            onOpenTodos();
        },
        [onOpenTodos]
    );

    const onCardKey = useCallback(
        (e: KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenTodos();
            }
        },
        [onOpenTodos]
    );

    return { onCardClick, onCardKey };
}
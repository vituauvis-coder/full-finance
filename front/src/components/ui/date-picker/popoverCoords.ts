export type PopoverPlacement = 'below' | 'above';

export type PopCoords = { top: number; left: number; width: number };

const VIEWPORT_GUTTER = 8;
const GAP_FROM_TRIGGER = 8;

type PopoverLayoutOpts = {
    widthPx: number;
    /** Altura fixa para ancoragem — evita “pular” ao medir o pop depois do render. */
    anchorHeightPx: number;
};

export function resolvePopoverPlacement(trigger: HTMLElement, anchorHeightPx: number): PopoverPlacement {
    const r = trigger.getBoundingClientRect();
    const fitsBelow = r.bottom + GAP_FROM_TRIGGER + anchorHeightPx <= window.innerHeight - VIEWPORT_GUTTER;
    if (fitsBelow) return 'below';
    const fitsAbove = r.top - GAP_FROM_TRIGGER - anchorHeightPx >= VIEWPORT_GUTTER;
    if (fitsAbove) return 'above';
    return 'below';
}

export function popoverCoordsFromTrigger(
    trigger: HTMLElement,
    placement: PopoverPlacement,
    opts: PopoverLayoutOpts
): PopCoords {
    const width = Math.min(opts.widthPx, window.innerWidth - 16);
    const r = trigger.getBoundingClientRect();
    let left = r.left;
    if (left + width > window.innerWidth - VIEWPORT_GUTTER) {
        left = Math.max(VIEWPORT_GUTTER, window.innerWidth - VIEWPORT_GUTTER - width);
    }
    if (left < VIEWPORT_GUTTER) left = VIEWPORT_GUTTER;

    const top =
        placement === 'below'
            ? r.bottom + GAP_FROM_TRIGGER
            : r.top - GAP_FROM_TRIGGER - opts.anchorHeightPx;

    return { top, left, width };
}
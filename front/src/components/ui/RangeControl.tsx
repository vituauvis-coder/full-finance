import {
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useId,
    useRef
} from 'react';

type Props = {
    min?: number;
    max: number;
    step?: number;
    value: number;
    accentColor: string;
    ariaLabel: string;
    disabled?: boolean;
    /** Atualização visual durante o arrasto (sem persistir). */
    onValueChange: (next: number) => void;
    /** Persistir valor final (soltar o arrasto ou teclado). */
    onCommit: (next: number) => void;
    onPointerDown?: (e: ReactPointerEvent) => void;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function roundStep(value: number, step: number) {
    if (!Number.isFinite(step) || step <= 0) return value;
    return Math.round(value / step) * step;
}

export function RangeControl({
    min = 0,
    max,
    step = 0.01,
    value,
    accentColor,
    ariaLabel,
    disabled = false,
    onValueChange,
    onCommit,
    onPointerDown
}: Props) {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragValueRef = useRef(value);
    const draggingRef = useRef(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const labelId = useId();

    const setDraggingUi = (active: boolean) => {
        draggingRef.current = active;
        rootRef.current?.classList.toggle('range-control--dragging', active);
    };
    const span = Math.max(max - min, 0);
    const pct = span > 0 ? ((clamp(value, min, max) - min) / span) * 100 : 0;

    const valueFromClientX = useCallback(
        (clientX: number) => {
            const track = trackRef.current;
            if (!track || span <= 0) return min;
            const rect = track.getBoundingClientRect();
            const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
            const raw = min + clamp(ratio, 0, 1) * span;
            return clamp(roundStep(raw, step), min, max);
        },
        [max, min, span, step]
    );

    const previewFromPointer = useCallback(
        (clientX: number) => {
            const next = valueFromClientX(clientX);
            dragValueRef.current = next;
            onValueChange(next);
        },
        [onValueChange, valueFromClientX]
    );

    const beginPointerDrag = (e: ReactPointerEvent) => {
        if (disabled) return;
        onPointerDown?.(e);
        e.preventDefault();
        e.stopPropagation();
        const track = trackRef.current;
        track?.setPointerCapture(e.pointerId);
        setDraggingUi(true);
        previewFromPointer(e.clientX);

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            previewFromPointer(ev.clientX);
        };
        const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            track?.releasePointerCapture(ev.pointerId);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            setDraggingUi(false);
            onCommit(dragValueRef.current);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const commitKeyboard = (next: number) => {
        const clamped = clamp(roundStep(next, step), min, max);
        dragValueRef.current = clamped;
        onValueChange(clamped);
        onCommit(clamped);
    };

    const onThumbKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        let delta = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
        if (e.key === 'Home') {
            e.preventDefault();
            e.stopPropagation();
            commitKeyboard(min);
            return;
        }
        if (e.key === 'End') {
            e.preventDefault();
            e.stopPropagation();
            commitKeyboard(max);
            return;
        }
        if (delta === 0) return;
        e.preventDefault();
        e.stopPropagation();
        commitKeyboard(value + delta);
    };

    return (
        <div
            ref={rootRef}
            className={`range-control${disabled ? ' range-control--disabled' : ''}`}
            data-zb-range=""
            style={{ ['--range-accent' as string]: accentColor }}
        >
            <div
                ref={trackRef}
                className="range-control__track"
                onPointerDown={beginPointerDrag}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="range-control__fill" style={{ width: `${pct}%` }} />
                <button
                    type="button"
                    className="range-control__thumb"
                    style={{ left: `${pct}%` }}
                    role="slider"
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={value}
                    aria-labelledby={labelId}
                    disabled={disabled || max <= min}
                    onKeyDown={onThumbKeyDown}
                    onPointerDown={beginPointerDrag}
                />
            </div>
            <span id={labelId} className="range-control__visually-hidden">
                {ariaLabel}
            </span>
        </div>
    );
}
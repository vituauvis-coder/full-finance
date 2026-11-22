import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../icons/MaterialIcon';

const POP_MIN_WIDTH_PX = 200;
const POP_ESTIMATE_HEIGHT_PX = 280;

function dashboardPortalRoot(): HTMLElement {
    if (typeof document === 'undefined') return document.body;
    return (
        document.querySelector('.page-content--dashboard-modern') ??
        document.querySelector('.page-content') ??
        document.body
    );
}

type PopCoords = { top: number; left: number; width: number };

function popCoordsFromTrigger(trigger: HTMLElement, popHeight = POP_ESTIMATE_HEIGHT_PX): PopCoords {
    const width = Math.min(POP_MIN_WIDTH_PX, window.innerWidth - 16);
    const r = trigger.getBoundingClientRect();
    let left = r.right - width;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
    if (left < 8) left = 8;

    let top = r.bottom + 6;
    if (top + popHeight > window.innerHeight - 8) {
        const above = r.top - 6 - popHeight;
        if (above >= 8) top = above;
    }

    return { top, left, width };
}

type Props = {
    icon: string;
    title: string;
    ariaLabel: string;
    children: ReactNode | ((close: () => void) => ReactNode);
};

export function RibbonIconPopover({ icon, title, ariaLabel, children }: Props) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<PopCoords | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => setOpen(false), []);

    const updateCoords = useCallback(() => {
        if (triggerRef.current) setCoords(popCoordsFromTrigger(triggerRef.current));
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        updateCoords();
        const align = requestAnimationFrame(updateCoords);
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);
        return () => {
            cancelAnimationFrame(align);
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open, updateCoords]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const toggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen((o) => !o);
    }, []);

    const popover =
        open && coords
            ? createPortal(
                  <div
                      ref={popRef}
                      className="movement-filter-ribbon__popover movement-filter-ribbon__popover--floating"
                      role="menu"
                      style={{
                          position: 'fixed',
                          top: coords.top,
                          left: coords.left,
                          width: coords.width,
                          zIndex: 10050
                      }}
                  >
                      {typeof children === 'function' ? children(close) : children}
                  </div>,
                  dashboardPortalRoot()
              )
            : null;

    return (
        <div className="movement-filter-ribbon__icon-pop">
            <button
                ref={triggerRef}
                type="button"
                className={`movement-filter-ribbon__icon-btn${open ? ' is-open' : ''}`}
                title={title}
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={toggle}
            >
                <MaterialIcon name={icon} variant="app" opticalSize={18} />
            </button>
            {popover}
        </div>
    );
}
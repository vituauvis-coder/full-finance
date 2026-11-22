import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { useCategories } from '../../../hooks/useCategories';
import { useDashboardFacets } from '../context/DashboardFacetsContext';

function portalRoot(): HTMLElement {
    if (typeof document === 'undefined') return document.body;
    return (
        document.querySelector('.page-content--dashboard-modern') ??
        document.querySelector('.page-content') ??
        document.body
    );
}

function useCategoryOptions() {
    const { data } = useFinanceData();
    const { categories } = useCategories('expense');
    return useMemo(() => {
        const fromApi = categories.map((c) => c.name);
        const fromData = new Set<string>();
        for (const e of data?.userExpenses ?? []) {
            if (e.category) fromData.add(e.category);
        }
        return [...new Set([...fromApi, ...fromData])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [categories, data]);
}

type Props = {
    variant?: 'field' | 'ribbon';
};

export function DashboardCategoryMultiSelect({ variant = 'field' }: Props) {
    const ctx = useDashboardFacets();
    const options = useCategoryOptions();
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const selected = ctx?.expenseCategories ?? new Set<string>();
    const count = selected.size;

    const summary =
        count === 0
            ? 'Todas as categorias'
            : count === 1
              ? [...selected][0]
              : `${count} categorias`;

    const updateCoords = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const width = Math.min(280, window.innerWidth - 24);
        const r = el.getBoundingClientRect();
        let left = r.left;
        if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - width);
        let top = r.bottom + 8;
        const estHeight = 320;
        if (top + estHeight > window.innerHeight - 12) {
            const above = r.top - 8 - estHeight;
            if (above >= 12) top = above;
        }
        setCoords({ top, left, width });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open, updateCoords]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    if (!ctx) return null;

    const panel =
        open && coords
            ? createPortal(
                  <div
                      ref={panelRef}
                      className="dashboard-category-multi__panel"
                      role="listbox"
                      aria-multiselectable="true"
                      aria-label="Categorias de saída"
                      style={{
                          position: 'fixed',
                          top: coords.top,
                          left: coords.left,
                          width: coords.width,
                          zIndex: 10050
                      }}
                  >
                      <div className="dashboard-category-multi__panel-head">
                          <span>Categorias</span>
                          <button
                              type="button"
                              className="dashboard-category-multi__clear"
                              onClick={() => ctx.clearExpenseCategories()}
                          >
                              Limpar
                          </button>
                      </div>
                      <ul className="dashboard-category-multi__list">
                          {options.map((name) => {
                              const on = selected.has(name);
                              return (
                                  <li key={name}>
                                      <button
                                          type="button"
                                          role="option"
                                          aria-selected={on}
                                          className={`dashboard-category-multi__option${on ? ' is-on' : ''}`}
                                          onClick={() => ctx.toggleExpenseCategory(name)}
                                      >
                                          <span
                                              className={`dashboard-category-multi__check${on ? ' is-on' : ''}`}
                                              aria-hidden
                                          >
                                              {on ? (
                                                  <MaterialIcon name="check" variant="app" opticalSize={16} />
                                              ) : null}
                                          </span>
                                          <span className="dashboard-category-multi__option-label">{name}</span>
                                      </button>
                                  </li>
                              );
                          })}
                      </ul>
                  </div>,
                  portalRoot()
              )
            : null;

    const ribbon = variant === 'ribbon';

    return (
        <div className={`dashboard-category-multi${ribbon ? ' dashboard-category-multi--ribbon' : ''}`}>
            <button
                ref={triggerRef}
                type="button"
                className={
                    ribbon
                        ? `movement-filter-ribbon__control movement-filter-ribbon__control--bare dashboard-category-multi__trigger--ribbon${
                              count > 0 ? ' is-active' : ''
                          }`
                        : `dashboard-category-multi__trigger${count > 0 ? ' is-active' : ''}`
                }
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                {ribbon ? null : <MaterialIcon name="sell" variant="app" opticalSize={18} aria-hidden />}
                <span className="dashboard-category-multi__summary">{summary}</span>
                <MaterialIcon name="expand_more" variant="app" opticalSize={ribbon ? 18 : 20} aria-hidden />
            </button>
            {panel}
        </div>
    );
}
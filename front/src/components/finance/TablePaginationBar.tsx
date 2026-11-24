import { TABLE_PAGE_SIZES, tableSliceRange } from '../../lib/tablePagination';

type Props = {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
    onPrev: () => void;
    onNext: () => void;
    ariaLabel?: string;
    /** Barra baixa, sem cartão — útil antes de totais/resumo. */
    compact?: boolean;
};

/**
 * Paridade com `legacy-web/js/shared/table-pagination.js` (DOM + textos).
 */
export function TablePaginationBar({
    page,
    pageCount,
    total,
    pageSize,
    onPageSizeChange,
    onPrev,
    onNext,
    ariaLabel = 'Paginação da tabela',
    compact = false
}: Props) {
    const { start, end } = tableSliceRange(page, pageSize, total);
    const atStart = page <= 1 || total === 0;
    const atEnd = page >= pageCount || total === 0;

    const info =
        total === 0
            ? 'Nenhum registro'
            : `${start + 1}–${end} de ${total} · Página ${page} de ${pageCount}`;

    return (
        <div className={`table-pagination-host${compact ? ' table-pagination-host--compact' : ''}`}>
            <div
                className={`table-pagination table-pagination--modern${compact ? ' table-pagination--compact' : ''}`}
                role="navigation"
                aria-label={ariaLabel}
            >
                <label className="table-pagination__size">
                    <span className="table-pagination__size-label">Linhas por página</span>
                    <select
                        className="table-pagination__select"
                        value={pageSize}
                        aria-label="Linhas por página"
                        onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
                    >
                        {TABLE_PAGE_SIZES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>
                <span className="table-pagination__info">{info}</span>
                <div className="table-pagination__nav">
                    <button
                        type="button"
                        className="table-pagination__btn"
                        disabled={atStart}
                        aria-label="Página anterior"
                        onClick={onPrev}
                    >
                        <i className="fas fa-chevron-left" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="table-pagination__btn"
                        disabled={atEnd}
                        aria-label="Próxima página"
                        onClick={onNext}
                    >
                        <i className="fas fa-chevron-right" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
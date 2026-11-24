import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { NotebookPage } from '../domain/notebookDoc';

type Props = {
    pages: NotebookPage[];
    activeIndex: number;
    savedLabel: string | null;
    onSelect: (index: number) => void;
    onAddPage: () => void;
};

export function NotebookPagesRail({ pages, activeIndex, savedLabel, onSelect, onAddPage }: Props) {
    const pageLabel = pages.length === 1 ? '1 página' : `${pages.length} páginas`;
    return (
        <aside className="estudos-notebook-rail" aria-label="Páginas do caderno">
            <div className="estudos-notebook-rail__head">
                <span className="estudos-notebook-rail__title">Páginas</span>
            </div>

            <ol className="estudos-notebook-rail__list">
                {pages.map((page, index) => (
                    <li key={page.id}>
                        <button
                            type="button"
                            className={`estudos-notebook-rail__item${index === activeIndex ? ' estudos-notebook-rail__item--active' : ''}`}
                            aria-current={index === activeIndex ? 'true' : undefined}
                            onClick={() => onSelect(index)}
                        >
                            <span className="estudos-notebook-rail__thumb" aria-hidden>
                                <span className="estudos-notebook-rail__thumb-lines" />
                            </span>
                            <span className="estudos-notebook-rail__label">Pág. {index + 1}</span>
                        </button>
                    </li>
                ))}
            </ol>

            <button type="button" className="estudos-notebook-rail__add" onClick={onAddPage}>
                <MaterialIcon name="note_add" variant="app" />
                Nova página
            </button>

            <p className="estudos-notebook-rail__status" aria-live="polite">
                {savedLabel ? (
                    <>
                        <span className="estudos-notebook-rail__status-saved">Salvo {savedLabel}</span>
                        <span className="estudos-notebook-rail__status-dot" aria-hidden>
                            ·
                        </span>
                        <span>{pageLabel}</span>
                    </>
                ) : (
                    <>
                        <span className="estudos-notebook-rail__status-unsaved">Não salvo</span>
                        <span className="estudos-notebook-rail__status-dot" aria-hidden>
                            ·
                        </span>
                        <span>{pageLabel}</span>
                    </>
                )}
            </p>
        </aside>
    );
}
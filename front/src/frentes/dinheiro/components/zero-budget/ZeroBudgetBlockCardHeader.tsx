import { DeleteIcon } from '../../../../components/icons/DeleteIcon';

type Props = {
    categoryName: string;
    colorHex: string;
    onDelete: () => void | Promise<void>;
};

export function ZeroBudgetBlockCardHeader({ categoryName, colorHex, onDelete }: Props) {
    const title = categoryName || '—';

    return (
        <header className="zero-budget__block-head">
            <div className="zero-budget__block-title-row">
                <span className="zero-budget__block-dot" style={{ backgroundColor: colorHex }} aria-hidden="true" />
                <h3 className="zero-budget__block-title">{title}</h3>
            </div>
            <button
                type="button"
                className="zero-budget__block-delete"
                title="Excluir bloco"
                aria-label={`Excluir bloco ${title}`}
                onClick={(ev) => {
                    ev.stopPropagation();
                    void onDelete();
                }}
            >
                <DeleteIcon size="md" />
            </button>
        </header>
    );
}
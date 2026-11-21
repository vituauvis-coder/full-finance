import { useCofrinhosRequestNewBucket } from '../../context/CofrinhosHeaderSlotContext';

type Props = { hidden?: boolean };

export function CofrinhosHeaderActions({ hidden }: Props) {
    const requestNew = useCofrinhosRequestNewBucket();
    if (hidden) return null;

    return (
        <div
            id="cofrinhos-header-actions"
            className="page-toolbar header-page-actions"
            data-toolbar-accent="cofrinhos"
            aria-label="Ações de cofrinhos"
        >
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="cofrinhos-add-bucket-btn"
                    className="page-toolbar__cta btn-primary header-action-btn"
                    aria-label="Nova caixinha"
                    onClick={(e) => {
                        e.stopPropagation();
                        requestNew();
                    }}
                >
                    <i className="fas fa-plus" aria-hidden="true"></i>
                    <span>Nova</span>
                </button>
            </div>
        </div>
    );
}
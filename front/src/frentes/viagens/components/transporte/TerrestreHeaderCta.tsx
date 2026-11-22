import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    onAdd: () => void;
};

export function TerrestreHeaderCta({ onAdd }: Props) {
    return (
        <div className="transporte-header__lista-actions">
            <button
                type="button"
                className="page-toolbar__cta btn-primary header-action-btn transporte-header__add-trecho"
                onClick={onAdd}
            >
                <MaterialIcon name="add" variant="app" />
                Adicionar
            </button>
        </div>
    );
}
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    onClick: () => void;
    /** Rótulo acessível e texto opcional ao lado do ícone. */
    label?: string;
    iconOnly?: boolean;
};

export function ViagensBackControl({ onClick, label = 'Voltar', iconOnly = false }: Props) {
    return (
        <button
            type="button"
            className={`viagens-back${iconOnly ? ' viagens-back--icon' : ''}`}
            onClick={onClick}
            aria-label={label}
            title={label}
        >
            <MaterialIcon name="arrow_back" variant="app" opticalSize={22} />
            {iconOnly ? null : <span className="viagens-back__label">{label}</span>}
        </button>
    );
}
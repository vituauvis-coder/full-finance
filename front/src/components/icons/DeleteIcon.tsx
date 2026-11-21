import { MaterialIcon } from './MaterialIcon';

export type DeleteIconSize = 'sm' | 'md' | 'lg';

const OPTICAL: Record<DeleteIconSize, number> = {
    sm: 16,
    md: 20,
    lg: 24
};

type Props = {
    size?: DeleteIconSize;
    className?: string;
    'aria-label'?: string;
};

/** Ícone padrão do portal para ações de exclusão (contorno, Material Symbols). */
export function DeleteIcon({ size = 'md', className = '', 'aria-label': ariaLabel }: Props) {
    return (
        <MaterialIcon
            name="delete_outline"
            variant="app"
            filled={false}
            weight={500}
            opticalSize={OPTICAL[size]}
            className={className}
            aria-label={ariaLabel}
        />
    );
}
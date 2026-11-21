import { MaterialIcon } from './MaterialIcon';
import type { DeleteIconSize } from './DeleteIcon';

type Props = {
    size?: DeleteIconSize;
    className?: string;
    'aria-label'?: string;
};

const OPTICAL: Record<DeleteIconSize, number> = {
    sm: 16,
    md: 20,
    lg: 24
};

/** Ícone padrão do portal para ações de edição. */
export function EditIcon({ size = 'md', className = '', 'aria-label': ariaLabel }: Props) {
    return (
        <MaterialIcon
            name="edit"
            variant="app"
            filled={false}
            weight={500}
            opticalSize={OPTICAL[size]}
            className={className}
            aria-label={ariaLabel}
        />
    );
}
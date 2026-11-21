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

/** Ícone de rateio / dividir saída (grupo de pessoas). */
export function SplitIcon({ size = 'md', className = '', 'aria-label': ariaLabel }: Props) {
    return (
        <MaterialIcon
            name="group"
            variant="app"
            filled={false}
            weight={500}
            opticalSize={OPTICAL[size]}
            className={className}
            aria-label={ariaLabel}
        />
    );
}

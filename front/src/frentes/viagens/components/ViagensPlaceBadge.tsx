type Props = {
    name: string;
    className?: string;
};

/** Etiqueta de cidade no mapa (mesmo visual do marcador de Recife). */
export function ViagensPlaceBadge({ name, className = '' }: Props) {
    return <span className={['viagens-place-badge__label', className].filter(Boolean).join(' ')}>{name}</span>;
}
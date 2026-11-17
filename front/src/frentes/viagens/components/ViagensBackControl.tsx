type Props = {
    label: string;
    onClick: () => void;
};

export function ViagensBackControl({ label, onClick }: Props) {
    return (
        <button type="button" className="viagens-back" onClick={onClick}>
            <span className="viagens-back__chev" aria-hidden>
                ‹
            </span>
            {label}
        </button>
    );
}
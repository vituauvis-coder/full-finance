import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onOrientReset: () => void;
};

export function ViagensMapNavStack({ onZoomIn, onZoomOut, onOrientReset }: Props) {
    return (
        <div className="viagens-map-ctrl-stack" role="group" aria-label="Controles do mapa">
            <button type="button" className="viagens-map-ctrl-stack__btn" onClick={onZoomIn} aria-label="Aumentar zoom">
                <MaterialIcon name="add" variant="app" opticalSize={22} filled={false} weight={500} />
            </button>
            <button type="button" className="viagens-map-ctrl-stack__btn" onClick={onZoomOut} aria-label="Diminuir zoom">
                <MaterialIcon name="remove" variant="app" opticalSize={22} filled={false} weight={500} />
            </button>
            <button
                type="button"
                className="viagens-map-ctrl-stack__btn"
                onClick={onOrientReset}
                aria-label="Recentralizar orientação do mapa"
                title="Recentralizar orientação"
            >
                <MaterialIcon name="explore" variant="app" opticalSize={20} filled={false} weight={500} />
            </button>
        </div>
    );
}
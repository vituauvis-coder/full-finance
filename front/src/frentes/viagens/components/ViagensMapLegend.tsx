type Props = {
    hasRoteiro: boolean;
};

export function ViagensMapLegend({ hasRoteiro }: Props) {
    return (
        <div className="viagens-map-legend" aria-live="polite" aria-label="Legenda do mapa">
            <ul className="viagens-map-legend__list">
                <li className="viagens-map-legend__item">
                    <span className="viagens-map-legend__swatch viagens-map-legend__swatch--flight" aria-hidden />
                    Voo
                </li>
                {hasRoteiro ? (
                    <>
                        <li className="viagens-map-legend__item">
                            <span
                                className="viagens-map-legend__swatch viagens-map-legend__swatch--ground"
                                aria-hidden
                            />
                            Terrestre
                        </li>
                        <li className="viagens-map-legend__item">
                            <span className="viagens-map-legend__swatch viagens-map-legend__swatch--walk" aria-hidden />
                            A pé
                        </li>
                    </>
                ) : null}
                <li className="viagens-map-legend__item">
                    <span className="viagens-map-legend__swatch viagens-map-legend__swatch--home" aria-hidden />
                    Casa
                </li>
            </ul>
            <p className="viagens-map-legend__meta">Satélite Esri · sombra solar (1 min)</p>
        </div>
    );
}
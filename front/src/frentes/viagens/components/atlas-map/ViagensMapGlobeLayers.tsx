import { Layer, Source } from 'react-map-gl/maplibre';
import { GLOBE_EARTH_RASTER_TILES } from '../../utils/maplibre-setup';
import { GLOBE_RASTER_BEFORE_ID, NIGHT_SHADE_IMAGE_COORDINATES } from '../../utils/nightShadeImage';

type Props = {
    nightShadeUrl: string | null;
    countryGeo: GeoJSON.FeatureCollection;
    showCountries: boolean;
};

export function ViagensMapGlobeLayers({ nightShadeUrl, countryGeo, showCountries }: Props) {
    return (
        <>
            <Source
                id="viagens-earth-raster"
                type="raster"
                tiles={GLOBE_EARTH_RASTER_TILES}
                tileSize={256}
                attribution="© Esri · World Imagery"
            >
                <Layer
                    id="viagens-earth-raster-layer"
                    type="raster"
                    beforeId={GLOBE_RASTER_BEFORE_ID}
                    paint={{
                        'raster-opacity': 1,
                        'raster-fade-duration': 0,
                        'raster-saturation': 0
                    }}
                />
            </Source>
            {nightShadeUrl ? (
                <Source
                    id="viagens-night-shade"
                    type="image"
                    url={nightShadeUrl}
                    coordinates={NIGHT_SHADE_IMAGE_COORDINATES}
                >
                    <Layer
                        id="viagens-night-shade-layer"
                        type="raster"
                        beforeId={GLOBE_RASTER_BEFORE_ID}
                        paint={{
                            'raster-opacity': 1,
                            'raster-fade-duration': 0
                        }}
                    />
                </Source>
            ) : null}
            {showCountries && countryGeo.features.length > 0 ? (
                <Source id="viagens-countries" type="geojson" data={countryGeo}>
                    <Layer
                        id="viagens-countries-fill"
                        type="fill"
                        paint={{
                            'fill-color': 'rgba(46, 196, 182, 0.14)',
                            'fill-opacity': 0.55,
                            'fill-outline-color': 'rgba(46, 196, 182, 0.28)'
                        }}
                    />
                </Source>
            ) : null}
        </>
    );
}
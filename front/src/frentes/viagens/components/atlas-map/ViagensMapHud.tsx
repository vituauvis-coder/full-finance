import type { ViagensMapLayersState } from '../../domain/viagensMapLayers';
import type { ViagensMapView } from '../../domain/viagensMapView';
import { ViagensMapLayerToggles } from '../ViagensMapLayerToggles';
import { ViagensMapLegend } from '../ViagensMapLegend';
import { ViagensMapNavStack } from '../ViagensMapNavStack';
import { ViagensMapViewToggle } from '../ViagensMapViewToggle';

type Props = {
    mapView: ViagensMapView;
    onMapViewChange: (view: ViagensMapView) => void;
    mapLayers: ViagensMapLayersState;
    onMapLayersChange: (next: ViagensMapLayersState) => void;
    hasRoteiro: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onOrientReset: () => void;
};

export function ViagensMapHud({
    mapView,
    onMapViewChange,
    mapLayers,
    onMapLayersChange,
    hasRoteiro,
    onZoomIn,
    onZoomOut,
    onOrientReset
}: Props) {
    return (
        <>
            <ViagensMapLegend hasRoteiro={hasRoteiro} />
            <ViagensMapLayerToggles
                value={mapLayers}
                onChange={onMapLayersChange}
                hasRoteiro={hasRoteiro}
            />
            <ViagensMapNavStack
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onOrientReset={onOrientReset}
            />
            <ViagensMapViewToggle value={mapView} onChange={onMapViewChange} />
        </>
    );
}
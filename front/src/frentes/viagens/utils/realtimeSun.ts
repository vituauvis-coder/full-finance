import type { LightSpecification } from 'maplibre-gl';
import {
    nightHemisphereFeature,
    subsolarPoint,
    sunLightForSubsolar,
    sunMarkerFeature,
    twilightBandFeature
} from '@motor/viagens/solar.js';
import type { Map } from 'maplibre-gl';

export type RealtimeSunSnapshot = {
    light: LightSpecification;
    night: GeoJSON.Feature<GeoJSON.Polygon>;
    twilight: GeoJSON.Feature<GeoJSON.Polygon>;
    sun: GeoJSON.Feature<GeoJSON.Point>;
};

export function realtimeSunSnapshot(date = new Date()): RealtimeSunSnapshot {
    const sub = subsolarPoint(date);
    return {
        light: sunLightForSubsolar(sub) as LightSpecification,
        night: nightHemisphereFeature(date),
        twilight: twilightBandFeature(date),
        sun: sunMarkerFeature(date)
    };
}

export function applyRealtimeSunToMap(map: Map, snap = realtimeSunSnapshot()): void {
    map.setLight(snap.light);
}
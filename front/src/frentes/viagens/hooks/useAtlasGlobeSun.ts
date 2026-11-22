import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import {
    applyGlobeVectorEarthColors,
    syncAtlasMapLayerStack
} from '../utils/maplibre-setup';
import { applyRealtimeSunToMap, realtimeSunSnapshot, type RealtimeSunSnapshot } from '../utils/realtimeSun';
import {
    createNightShadeObjectUrl,
    NIGHT_SHADE_IMAGE_COORDINATES,
    revokeNightShadeObjectUrl
} from '../utils/nightShadeImage';

const SUN_REFRESH_MS = 60_000;

export function useAtlasGlobeSun(mapRef: RefObject<MapRef | null>) {
    const [sunOverlay, setSunOverlay] = useState<RealtimeSunSnapshot>(() => realtimeSunSnapshot());
    const [nightShadeUrl, setNightShadeUrl] = useState<string | null>(null);
    const nightShadeUrlRef = useRef<string | null>(null);

    const refreshAtlasSun = useCallback(async () => {
        const snap = realtimeSunSnapshot();
        setSunOverlay(snap);
        const url = await createNightShadeObjectUrl(new Date());
        revokeNightShadeObjectUrl(nightShadeUrlRef.current ?? undefined);
        nightShadeUrlRef.current = url;
        setNightShadeUrl(url);
        const map = mapRef.current?.getMap();
        if (!map?.isStyleLoaded()) return;
        applyRealtimeSunToMap(map, snap);
        const src = map.getSource('viagens-night-shade') as
            | { updateImage?: (spec: { url: string; coordinates: [number, number][] }) => void }
            | undefined;
        if (src?.updateImage) {
            src.updateImage({ url, coordinates: NIGHT_SHADE_IMAGE_COORDINATES });
        }
        applyGlobeVectorEarthColors(map);
        syncAtlasMapLayerStack(map);
    }, [mapRef]);

    useEffect(() => {
        void refreshAtlasSun();
        const timer = window.setInterval(() => void refreshAtlasSun(), SUN_REFRESH_MS);
        return () => {
            window.clearInterval(timer);
            revokeNightShadeObjectUrl(nightShadeUrlRef.current ?? undefined);
            nightShadeUrlRef.current = null;
        };
    }, [refreshAtlasSun]);

    return { sunOverlay, nightShadeUrl, refreshAtlasSun };
}
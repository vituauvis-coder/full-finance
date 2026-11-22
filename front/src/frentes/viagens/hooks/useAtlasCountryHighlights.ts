import { useEffect, useState } from 'react';
import { buildCountryHighlightCollection } from '../utils/countryHighlightsGeo';

export function useAtlasCountryHighlights(labels: string[]) {
    const [countryGeo, setCountryGeo] = useState<GeoJSON.FeatureCollection>(() => ({
        type: 'FeatureCollection',
        features: []
    }));

    useEffect(() => {
        let cancelled = false;
        void buildCountryHighlightCollection(labels).then((geo) => {
            if (!cancelled) setCountryGeo(geo);
        });
        return () => {
            cancelled = true;
        };
    }, [labels]);

    return countryGeo;
}
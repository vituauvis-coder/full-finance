export type ViagensMapLayerKey = 'flights' | 'roteiro' | 'countries';

export type ViagensMapLayersState = Record<ViagensMapLayerKey, boolean>;

const STORAGE_KEY = 'meu-mundo:viagens-map-layers';

const DEFAULT: ViagensMapLayersState = {
    flights: true,
    roteiro: true,
    countries: true
};

export function loadViagensMapLayers(): ViagensMapLayersState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT };
        const parsed = JSON.parse(raw) as Partial<ViagensMapLayersState>;
        return {
            flights: parsed.flights !== false,
            roteiro: parsed.roteiro !== false,
            countries: parsed.countries !== false
        };
    } catch {
        return { ...DEFAULT };
    }
}

export function persistViagensMapLayers(state: ViagensMapLayersState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* ignore */
    }
}
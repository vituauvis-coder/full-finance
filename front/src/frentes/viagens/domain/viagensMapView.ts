export type ViagensMapView = 'flat' | 'globe';

const STORAGE_KEY = 'meu-mundo:viagens-map-view';

export function loadViagensMapView(): ViagensMapView {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === 'flat' || raw === 'globe') return raw;
    } catch {
        /* ignore */
    }
    return 'flat';
}

export function persistViagensMapView(view: ViagensMapView): void {
    try {
        localStorage.setItem(STORAGE_KEY, view);
    } catch {
        /* ignore */
    }
}

export function projectionForView(view: ViagensMapView): 'mercator' | 'globe' {
    return view === 'globe' ? 'globe' : 'mercator';
}
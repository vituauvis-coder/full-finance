export const SHEET_ZOOM_MIN = 0.55;
export const SHEET_ZOOM_MAX = 2;
export const SHEET_ZOOM_STEP = 0.1;
export const SHEET_ZOOM_DEFAULT = 1;

export function clampSheetZoom(value: number): number {
    const rounded = Math.round(value * 100) / 100;
    return Math.min(SHEET_ZOOM_MAX, Math.max(SHEET_ZOOM_MIN, rounded));
}

export function sheetZoomPercent(zoom: number): string {
    return `${Math.round(zoom * 100)}%`;
}
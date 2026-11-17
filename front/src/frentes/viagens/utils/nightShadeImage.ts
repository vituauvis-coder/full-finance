import { nightShadeAlpha, sunAltitudeDeg } from '@motor/viagens/solar.js';

const W = 720;
const H = 360;

/** Cantos da imagem no mapa (equiretangular → globo). */
export const NIGHT_SHADE_IMAGE_COORDINATES: [number, number][] = [
    [-180, 85],
    [180, 85],
    [180, -85],
    [-180, -85]
];

/** URL objeto PNG com alpha = sombra noturna para o instante `date`. */
export async function createNightShadeObjectUrl(date = new Date()): Promise<string> {
    const pixels = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) {
        const lat = 90 - ((j + 0.5) * 180) / H;
        for (let i = 0; i < W; i++) {
            const lng = -180 + ((i + 0.5) * 360) / W;
            const a = Math.round(nightShadeAlpha(sunAltitudeDeg(lng, lat, date)) * 255);
            const idx = (j * W + i) * 4;
            pixels[idx] = 8;
            pixels[idx + 1] = 14;
            pixels[idx + 2] = 36;
            pixels[idx + 3] = a;
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('nightShadeImage: canvas 2d indisponível');
    ctx.putImageData(new ImageData(pixels, W, H), 0, 0);
    const blob = await awaitCanvasBlob(canvas);
    return URL.createObjectURL(blob);
}

function awaitCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('nightShadeImage: toBlob falhou'))), 'image/png');
    });
}

export function revokeNightShadeObjectUrl(url: string | undefined): void {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

const GLOBE_LABEL_ANCHOR = 'place_continent';

const ATLAS_BOUNDARY_LAYERS = ['boundary_country_outline', 'boundary_country_inner'] as const;

function firstSymbolLayerId(map: import('maplibre-gl').Map): string | undefined {
    return map.getStyle()?.layers?.find((layer) => layer.type === 'symbol')?.id;
}

/** Satélite → sombra → fronteiras → todos os rótulos (place_country fica acima da noite). */
export function placeGlobeNightShadeLayer(map: import('maplibre-gl').Map): void {
    const belowLabels = firstSymbolLayerId(map);
    if (!belowLabels) return;

    try {
        if (map.getLayer('viagens-earth-raster-layer')) {
            map.moveLayer('viagens-earth-raster-layer', belowLabels);
        }
        if (map.getLayer('viagens-night-shade-layer')) {
            map.moveLayer('viagens-night-shade-layer', belowLabels);
            if (map.getLayer('viagens-earth-raster-layer')) {
                map.moveLayer('viagens-earth-raster-layer', 'viagens-night-shade-layer');
            }
        }
        for (const id of ATLAS_BOUNDARY_LAYERS) {
            if (!map.getLayer(id)) continue;
            map.moveLayer(id, belowLabels);
        }
        if (
            map.getLayer('boundary_country_inner') &&
            map.getLayer('boundary_country_outline')
        ) {
            map.moveLayer('boundary_country_outline', 'boundary_country_inner');
        }
    } catch {
        /* estilo ainda montando */
    }
}

export const GLOBE_RASTER_BEFORE_ID = GLOBE_LABEL_ANCHOR;
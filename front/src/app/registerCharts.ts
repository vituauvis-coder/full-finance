import { Chart, registerables } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';

let registered = false;

/** Registro único — treemap + tipos base (barras, etc.). */
export function ensureChartsRegistered() {
    if (registered) return;
    Chart.register(...registerables, TreemapController, TreemapElement);
    registered = true;
}

export { Chart };
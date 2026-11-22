import type { Movement } from '../../../lib/types/finance';
import { MONTH_NAMES } from '../../../lib/period';
import { type CofrinhoApplication, type CofrinhoBucket } from './cofrinhoAggregations';
import { collectCofrinhoInflowEvents, inflowEventMatchesYear } from './cofrinhoInflowEvents';
import { bucketChartBarGradient, bucketColorHex } from './cofrinhoConstants';
import { cofrinhoBucketDeltaForMovement } from './cofrinhoMovementLedger';
import { toYearMonthKey } from './cofrinhoPeriod';
import { movementDate } from '../../../lib/period';

export type CofrinhoAnnualChartPoint = {
    index: number;
    label: string;
    yearMonth: string;
    monthInflow: number;
    cumulative: number;
    [stackKey: string]: number | string;
};

export type CofrinhoAnnualChartSeries = {
    year: number;
    points: CofrinhoAnnualChartPoint[];
    buckets: {
        id: string;
        name: string;
        color: string;
        gradientTop: string;
        gradientBottom: string;
        stackKey: string;
    }[];
};

function stackKey(bucketId: string) {
    return `b_${String(bucketId).replace(/-/g, '_')}`;
}

function movementYearMonth(e: Movement): string {
    const d = e.date;
    if (typeof d === 'string' && d.trim()) return toYearMonthKey(d);
    try {
        return toYearMonthKey(movementDate(e).toISOString());
    } catch {
        return '';
    }
}

function outflowForBucketInMonth(bucket: CofrinhoBucket, yearMonth: string, expenses: Movement[]): number {
    let sum = 0;
    for (const e of expenses ?? []) {
        if (e.isPaid === false) continue;
        if (movementYearMonth(e) !== yearMonth) continue;
        const delta = cofrinhoBucketDeltaForMovement(e, bucket);
        if (delta >= 0) continue;
        sum += Math.abs(delta);
    }
    return Math.round(sum * 100) / 100;
}

export function buildCofrinhoAnnualChartSeries(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    year: number
): CofrinhoAnnualChartSeries {
    const ordered = [...(buckets ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const bucketMeta = ordered.map((b) => {
        const grad = bucketChartBarGradient(b.colorKey);
        return {
            id: b.id,
            name: String(b.name ?? 'Caixinha').trim() || 'Caixinha',
            color: bucketColorHex(b.colorKey),
            gradientTop: grad.top,
            gradientBottom: grad.bottom,
            stackKey: stackKey(b.id)
        };
    });

    const inflows = collectCofrinhoInflowEvents(ordered, applications, expenses).filter((ev) =>
        inflowEventMatchesYear(ev, year)
    );

    const monthlyNet = Array.from({ length: 12 }, () => new Map<string, number>());
    for (let mi = 0; mi < 12; mi++) {
        const yearMonth = `${year}-${String(mi + 1).padStart(2, '0')}`;
        for (const b of ordered) {
            const inflow = inflows
                .filter((ev) => ev.bucketId === b.id && ev.yearMonth === yearMonth)
                .reduce((s, ev) => s + ev.amount, 0);
            const outflow = outflowForBucketInMonth(b, yearMonth, expenses);
            monthlyNet[mi].set(b.id, Math.round((inflow - outflow) * 100) / 100);
        }
    }

    const cumulativeByBucket = new Map<string, number>();
    const points: CofrinhoAnnualChartPoint[] = [];

    for (let mi = 0; mi < 12; mi++) {
        const yearMonth = `${year}-${String(mi + 1).padStart(2, '0')}`;
        const point: CofrinhoAnnualChartPoint = {
            index: mi,
            label: MONTH_NAMES[mi],
            yearMonth,
            monthInflow: 0,
            cumulative: 0
        };

        for (const b of ordered) {
            const delta = monthlyNet[mi].get(b.id) ?? 0;
            const prev = cumulativeByBucket.get(b.id) ?? 0;
            const next = Math.max(0, Math.round((prev + delta) * 100) / 100);
            cumulativeByBucket.set(b.id, next);
            point[stackKey(b.id)] = next;
        }

        const monthInflow = inflows
            .filter((ev) => ev.yearMonth === yearMonth)
            .reduce((s, ev) => s + ev.amount, 0);
        point.monthInflow = Math.round(monthInflow * 100) / 100;
        point.cumulative = [...cumulativeByBucket.values()].reduce(
            (s, v) => s + (Number(v) || 0),
            0
        );
        point.cumulative = Math.round(point.cumulative * 100) / 100;
        points.push(point);
    }

    return { year, points, buckets: bucketMeta };
}
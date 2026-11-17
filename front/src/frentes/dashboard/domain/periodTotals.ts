import { sumInPeriod as sumInPeriodMotor } from '@motor/dinheiro/dashboard-period.js';
import type { Movement } from '../../../lib/types/finance';

export function sumInPeriod(
    items: Movement[],
    start: Date,
    end: Date,
    predicate: (m: Movement) => boolean
) {
    return sumInPeriodMotor(items, start, end, predicate);
}
import { fetchPeriodBalance } from '../../../lib/periodBalance';
import { currentMonthPeriodBounds } from './profilePeriod';

export async function fetchProfilePeriodBalance(now = new Date()): Promise<number | null> {
    const { startDate, endDate } = currentMonthPeriodBounds(now);
    return fetchPeriodBalance(startDate, endDate);
}
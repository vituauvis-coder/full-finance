/**
 * @param {{ householdId?: string | null, userId?: string } | null | undefined} trip
 * @param {{ userId: string, householdIds: string[] }} viewer
 */
export function canAccessTrip(trip, viewer) {
    if (!trip) return false;
    if (trip.householdId && viewer.householdIds.includes(trip.householdId)) return true;
    if (!trip.householdId && trip.userId === viewer.userId) return true;
    return false;
}

/**
 * Viagens são compartilhadas entre todos os logins (não isoladas por household).
 *
 * @param {{ householdId?: string | null, userId?: string } | null | undefined} trip
 * @param {{ userId: string, householdIds?: string[] }} viewer
 */
export function canAccessTrip(trip, viewer) {
    if (!trip) return false;
    if (!viewer?.userId) return false;
    return true;
}

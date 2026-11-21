import { travelDocumentFromFinancePreferences } from '@motor/viagens/travel-document.js';
import type { HouseholdMemberRow, TravelDocument, UserProfile } from '../../../lib/types/finance';

export type TravelRosterPerson = {
    id: string;
    name: string;
    email?: string;
    travelDocument: TravelDocument;
    isSelf?: boolean;
};

export function buildTravelRoster(
    userProfile: UserProfile | null | undefined,
    householdMembers: HouseholdMemberRow[] | null | undefined
): TravelRosterPerson[] {
    const byId = new Map<string, TravelRosterPerson>();
    const selfId = userProfile?.id;
    if (selfId) {
        const name = (userProfile?.name ?? userProfile?.email ?? 'Você').trim();
        byId.set(selfId, {
            id: selfId,
            name,
            email: userProfile?.email,
            travelDocument: travelDocumentFromFinancePreferences(userProfile?.financePreferences),
            isSelf: true
        });
    }
    for (const m of householdMembers ?? []) {
        const id = m.id;
        if (!id) continue;
        byId.set(id, {
            id,
            name: (m.name ?? m.email ?? 'Usuário').trim(),
            email: m.email,
            travelDocument: m.travelDocument ?? travelDocumentFromFinancePreferences(null),
            isSelf: id === selfId
        });
    }
    return [...byId.values()].sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
    });
}

export function travelerFromRosterPerson(person: TravelRosterPerson, travelerId: string): Partial<import('../types').TripTravelerIdentity> {
    const doc = person.travelDocument ?? {};
    return {
        id: travelerId,
        linkedUserId: person.id,
        fullName: person.name,
        passportNumber: doc.passportNumber
    };
}
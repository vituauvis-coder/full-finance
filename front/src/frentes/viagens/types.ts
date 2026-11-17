export type TripStatus = 'planejada' | 'em_curso' | 'realizada';

export interface TripDestination {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    arrivedOn?: string | null;
    departedOn?: string | null;
    country?: string | null;
    isPrincipal?: boolean;
    kind?: string | null;
}

export interface TripExpense {
    id: string;
    amount: number;
    category?: string;
    customCategoryId?: string | null;
    destinationId?: string | null;
    description?: string;
    spentOn?: string;
}

export interface TripStay {
    id: string;
    destinationId?: string | null;
    name?: string;
    amount?: number;
    checkInOn?: string;
    checkOutOn?: string;
}

export interface TripLeg {
    id: string;
    fromName?: string;
    toName?: string;
    amount?: number;
    tripDestinationId?: string | null;
    departedOn?: string;
}

export interface TripDocItem {
    id: string;
    title: string;
    done?: boolean;
}

export interface TripCheckItem {
    id: string;
    title: string;
    done?: boolean;
}

export interface TripItineraryDay {
    id: string;
    dayKey?: string;
    day_key?: string;
    items?: { id: string; title: string }[];
}

export interface TripFlightSegment {
    id: string;
    title?: string;
    simulations?: Record<string, unknown>[];
}

export interface TripTimeScenario {
    id: string;
    title?: string;
    [key: string]: unknown;
}

export interface TripPayload {
    destinations?: TripDestination[];
    expenses?: TripExpense[];
    stays?: TripStay[];
    itinerary?: TripItineraryDay[];
    legs?: TripLeg[];
    flight_segments?: TripFlightSegment[];
    flightSegments?: TripFlightSegment[];
    documents?: TripDocItem[];
    checks?: TripCheckItem[];
    budget_custom_categories?: { id: string; label: string }[];
    budgetCustomCategories?: { id: string; label: string }[];
    time_scenarios?: TripTimeScenario[];
    timeScenarios?: TripTimeScenario[];
    chosen_time_scenario_id?: string | null;
    chosenTimeScenarioId?: string | null;
    scenario_criteria?: unknown[];
    scenarioCriteria?: unknown[];
    [key: string]: unknown;
}

export interface Trip {
    id: string;
    title: string;
    startsOn: string | null;
    endsOn: string | null;
    statusOverride: string | null;
    budgetCaps: Record<string, number>;
    payload: TripPayload;
    effectiveStatus?: TripStatus;
    tripTotal?: number;
    capUsedFraction?: number;
    cityCount?: number;
}

export interface VisitHover {
    placeName: string;
    tripTitle: string;
    monthYear: string;
    citySpent: number;
    tripTotal: number;
}

export interface MapVisit {
    id: string;
    tripId: string;
    tripTitle: string;
    status: TripStatus;
    destination: TripDestination;
    hover: VisitHover;
}

export interface TripsListResponse {
    trips: Trip[];
    visits: MapVisit[];
}

export interface TripDetailResponse {
    trip: Trip;
    scenarioSnapshots?: unknown[];
    scenarioWinnerId?: string | null;
}

export interface GeocodeHit {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    kind: string;
}
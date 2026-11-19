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
    /** URL externa (Drive, e-mail, etc.). */
    linkUrl?: string;
    /** Nome do arquivo anexado localmente. */
    attachmentName?: string;
    /** URL blob/object para preview (sessão atual). */
    attachmentUrl?: string;
}

export interface TripCheckItem {
    id: string;
    title: string;
    done?: boolean;
    dueOn?: string;
    due_on?: string;
    /** Preenchido quando o item veio de um documento pendente. */
    sourceDocumentId?: string;
    completed?: boolean;
}

export interface TripItineraryDay {
    id: string;
    dayKey?: string;
    day_key?: string;
    items?: { id: string; title: string }[];
}

export type TripFlightSimulationStatus = 'candidata' | 'escolhida' | 'descartada';

export type TripFlightInsight =
    | 'recomendado'
    | 'melhor_rota'
    | 'escala_longa'
    | 'visto_transito'
    | 'custo_elevado';

export interface TripFlightConnection {
    id: string;
    place: string;
    layoverMinutes?: number | null;
}

export type TripFlightPayWith = 'cash' | 'points';

export interface TripFlightMiles {
    payWith: TripFlightPayWith;
    originProgramId?: string | null;
    destinationProgramId?: string | null;
    destinationPoints?: number | null;
    taxesAmount?: number | null;
    taxesCurrency?: string;
    /** Câmbio da moeda da taxa → BRL (1 se BRL). */
    taxFxRate?: number | null;
    taxIofPercent?: number;
    taxSpreadPercent?: number;
    conversionFrom?: number;
    conversionTo?: number;
    bonusPercent?: number;
    bonusActive?: boolean;
    emissionId?: string | null;
}

export interface TripFlightSimulation {
    id: string;
    label: string;
    origin: string;
    destination: string;
    departsAt?: string | null;
    arrivesAt?: string | null;
    connections: TripFlightConnection[];
    isRoundTrip: boolean;
    returnDepartsAt?: string | null;
    returnArrivesAt?: string | null;
    returnConnections: TripFlightConnection[];
    amount?: number | null;
    extrasAmount?: number | null;
    baggage?: { kg10: number; kg23: number; kg32: number };
    baggageIncluded?: boolean;
    insight: TripFlightInsight;
    notes: string;
    status: TripFlightSimulationStatus;
    tripDestinationId?: string | null;
    bookingURL?: string | null;
    travelers?: number;
    miles?: TripFlightMiles;
}

export interface TripFlightSegment {
    id: string;
    title: string;
    simulations: TripFlightSimulation[];
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
    /** Países da viagem (seleção manual; senão infere do roteiro). */
    tripCountries?: string[];
    trip_countries?: string[];
    [key: string]: unknown;
}

export interface TripCreator {
    id: string;
    name: string | null;
    email?: string | null;
}

export interface Trip {
    id: string;
    userId?: string;
    creator?: TripCreator | null;
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
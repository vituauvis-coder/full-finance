export type TripStatus = 'planejada' | 'em_curso' | 'realizada';

export type TripPlaceKind = 'city' | 'neighborhood' | 'country' | 'region' | 'poi' | 'airport' | 'other';

export interface TripDestination {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    arrivedOn?: string | null;
    departedOn?: string | null;
    country?: string | null;
    isPrincipal?: boolean;
    kind?: TripPlaceKind | string | null;
    /** Bairro ou subárea (ex.: Malasaña). */
    neighborhood?: string | null;
    /** Cidade / município vinculado ao pin (latim). */
    city?: string | null;
    /** Endereço completo do geocode (latim). */
    address?: string | null;
    /** Resumo para o guia do roteiro. */
    guideSummary?: string | null;
    /** Destaques em bullets (praias, museus, dicas). */
    guideHighlights?: string[];
    /** Avisos importantes (visto, segurança, horários). */
    guideAlerts?: string[];
}

export type TripExpensePaymentMethod = 'pix' | 'credit_card';

export interface TripExpense {
    id: string;
    amount: number;
    category?: string;
    customCategoryId?: string | null;
    destinationId?: string | null;
    description?: string;
    spentOn?: string;
    paymentMethod?: TripExpensePaymentMethod;
    payment_method?: TripExpensePaymentMethod;
    /** Parcelas no cartão (1 = à vista no cartão). */
    installments?: number;
    installment_count?: number;
    /** Conta cartão (Dinheiro) quando paymentMethod = credit_card. */
    accountId?: string | null;
    account_id?: string | null;
    /** Saída espelhada no módulo Dinheiro. */
    financeExpenseId?: string | null;
    finance_expense_id?: string | null;
    /** Valor saiu do cofrinho da viagem (Pix; não confunde com forma de pagamento). */
    paidFromCofrinho?: boolean;
    paid_from_cofrinho?: boolean;
}

export interface TripStay {
    id: string;
    destinationId?: string | null;
    name?: string;
    amount?: number;
    checkInOn?: string;
    checkOutOn?: string;
    check_in_on?: string;
    check_out_on?: string;
    city?: string;
    country?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    paid?: boolean;
    paidOn?: string;
    paid_on?: string;
    notes?: string;
    source?: 'manual' | 'nominatim' | 'overpass' | 'search';
    osmId?: string;
    osmType?: string;
    kind?: string;
}

export interface TripLeg {
    id: string;
    fromName?: string;
    toName?: string;
    amount?: number;
    tripDestinationId?: string | null;
    departedOn?: string;
}

export type TripGroundTransportKind =
    | 'car_rental'
    | 'train'
    | 'bus'
    | 'taxi'
    | 'rideshare'
    | 'ferry'
    | 'metro'
    | 'other';

export interface TripGroundTransport {
    id: string;
    kind?: TripGroundTransportKind | string;
    title?: string;
    fromName?: string;
    from_name?: string;
    toName?: string;
    to_name?: string;
    amount?: number;
    tripDestinationId?: string | null;
    trip_destination_id?: string | null;
    departedOn?: string;
    departed_on?: string;
    notes?: string;
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

export type TripCountryCheckRef = {
    /** Rótulo canônico do país (PT). */
    country: string;
    field: 'requiredDocs' | 'paymentMethods' | 'internetChip';
};

export interface TripCheckItem {
    id: string;
    title: string;
    done?: boolean;
    dueOn?: string;
    due_on?: string;
    /** Preenchido quando o item veio de um documento pendente. */
    sourceDocumentId?: string;
    /** Item exibido no ID viagem (país) — mesma entrada do checklist. */
    countryCheck?: TripCountryCheckRef;
    completed?: boolean;
}

export interface TripTravelerIdentity {
    id: string;
    /** Usuário Meu Mundo vinculado (você ou membro da casa). */
    linkedUserId?: string | null;
    fullName?: string;
    passportNumber?: string;
    passportExpiresOn?: string;
    birthDate?: string;
    cpf?: string;
}

export interface TripIdentityData {
    travelers?: TripTravelerIdentity[];
}

export interface TripCountryTravelNote {
    /** Valor na moeda local (texto, ex. "100" ou "1.250,50") */
    localAmount?: string;
    /** Cotação gravada automaticamente (ex. "1 USD = R$ 5,42") */
    fxQuoteText?: string;
    fxQuoteAsOf?: string | null;
    /** Legado — linha de cotação editável */
    currency?: string;
    brlValue?: string;
    requiredDocs?: string;
    paymentMethods?: string;
    internetChip?: string;
    /** Evita recriar itens do checklist após o usuário apagar tudo. */
    checksSeeded?: Partial<Record<'requiredDocs' | 'paymentMethods' | 'internetChip', boolean>>;
    /** Legado */
    obligations?: string;
}

/** Notas por país (rótulo canônico PT). */
export type TripCountryTravelNotes = Record<string, TripCountryTravelNote>;

export type TripItineraryItemCategory =
    | 'sight'
    | 'food'
    | 'transport'
    | 'lodging'
    | 'shopping'
    | 'important';

export type TripItineraryTravelMode = 'flight' | 'ground' | 'walk';

export interface TripItineraryItem {
    id: string;
    title: string;
    destinationId?: string | null;
    time?: string | null;
    category?: TripItineraryItemCategory | string | null;
    /** Trecho até este ponto (mapa e planner). */
    travelMode?: TripItineraryTravelMode | string | null;
    /** Bilhete terrestre (aba Transporte) usado nesta atividade. */
    groundTransportId?: string | null;
    ground_transport_id?: string | null;
    /** Nome da cidade/local (persiste mesmo se o destino for reordenado no payload). */
    placeName?: string | null;
    place_name?: string | null;
    notes?: string | null;
    highlight?: boolean;
    /** Atividade confirmada (modo leitura com resumo visual). */
    saved?: boolean | null;
}

export interface TripItineraryDay {
    id: string;
    dayKey?: string;
    day_key?: string;
    /** Parada do roteiro à qual o dia está ligado. */
    destinationId?: string | null;
    placeName?: string | null;
    place_name?: string | null;
    title?: string | null;
    /** Nota do dia (ex.: feriado BR) — não é atividade. */
    notes?: string | null;
    /** Hospedagem base do dia (ponto fixo de saída) — id em payload.stays. */
    stayId?: string | null;
    /**
     * true = usuário escolheu/limpou a tag; não sobrescrever com sugestão automática.
     */
    stayIdManual?: boolean | null;
    /** Dia confirmado (modo leitura no planner). */
    saved?: boolean | null;
    items?: TripItineraryItem[];
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
    name?: string;
    title?: string;
    hops?: unknown[];
    vacations?: unknown[];
    remote?: unknown;
    vacation_balance?: number | null;
    vacationBalance?: number | null;
    notes?: string;
    pulls_flights_from_ficha?: boolean;
    pullsFlightsFromFicha?: boolean;
    own_hops?: unknown[];
    ownHops?: unknown[];
    [key: string]: unknown;
}

export interface TripPayload {
    destinations?: TripDestination[];
    expenses?: TripExpense[];
    stays?: TripStay[];
    itinerary?: TripItineraryDay[];
    legs?: TripLeg[];
    ground_transports?: TripGroundTransport[];
    groundTransports?: TripGroundTransport[];
    flight_segments?: TripFlightSegment[];
    flightSegments?: TripFlightSegment[];
    documents?: TripDocItem[];
    checks?: TripCheckItem[];
    budget_custom_categories?: { id: string; label: string; icon?: string }[];
    budgetCustomCategories?: { id: string; label: string; icon?: string }[];
    /** Rótulos personalizados das categorias fixas do orçamento (id → nome). */
    budget_category_labels?: Record<string, string>;
    budgetCategoryLabels?: Record<string, string>;
    /** Categorias padrão removidas da lista do orçamento (ids de `ORCAMENTO_CATEGORIES`). */
    budget_hidden_categories?: string[];
    budgetHiddenCategories?: string[];
    time_scenarios?: TripTimeScenario[];
    timeScenarios?: TripTimeScenario[];
    chosen_time_scenario_id?: string | null;
    chosenTimeScenarioId?: string | null;
    scenario_criteria?: unknown[];
    scenarioCriteria?: unknown[];
    /** Países da viagem (seleção manual; senão infere do roteiro). */
    tripCountries?: string[];
    trip_countries?: string[];
    tripIdentity?: TripIdentityData;
    trip_identity?: TripIdentityData;
    countryTravelNotes?: TripCountryTravelNotes;
    country_travel_notes?: TripCountryTravelNotes;
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

export type TripFinanceLedgerKind = 'aporte' | 'gasto' | 'gasto_cofrinho';

export interface TripFinanceMovementLine {
    id: string;
    tripExpenseId?: string | null;
    amount: number;
    description: string;
    source: 'finance' | 'payload';
    ledgerKind?: TripFinanceLedgerKind;
    category?: string | null;
    date?: string | null;
    author: { id: string; name: string } | null;
}

export type TripCofrinhoMeta = {
    aportes: number;
    gastosCofrinho: number;
    rendimento: number;
    remaining: number;
};

export interface TripDetailResponse {
    trip: Trip;
    scenarioSnapshots?: unknown[];
    scenarioWinnerId?: string | null;
    financeMovements?: {
        lines: TripFinanceMovementLine[];
        totals: { amount: number; aportes?: number; gastosCofrinho?: number };
        cofrinho?: TripCofrinhoMeta;
    };
}

export interface GeocodeHit {
    name: string;
    country: string;
    address?: string;
    city?: string;
    countryCode?: string;
    latitude: number;
    longitude: number;
    kind: string;
    category?: string;
    placeType?: string;
}
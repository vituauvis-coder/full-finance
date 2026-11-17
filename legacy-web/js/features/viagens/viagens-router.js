const HASH_HOME = '#viagens';
const HASH_TRIP_PREFIX = '#viagens/trip/';

let onRoute = null;

export function setViagensRouteHandler(handler) {
    onRoute = handler;
}

export function parseViagensRoute() {
    const h = window.location.hash || HASH_HOME;
    if (h.startsWith(HASH_TRIP_PREFIX)) {
        const id = h.slice(HASH_TRIP_PREFIX.length).split('/')[0];
        if (id) return { view: 'trip', tripId: id };
    }
    return { view: 'home' };
}

export function navigateViagensHome() {
    const target = HASH_HOME;
    if (window.location.hash !== target) {
        window.location.hash = target;
    } else {
        onRoute?.();
    }
}

export function navigateViagensTrip(tripId) {
    const target = `${HASH_TRIP_PREFIX}${tripId}`;
    if (window.location.hash !== target) {
        window.location.hash = target;
    } else {
        onRoute?.();
    }
}
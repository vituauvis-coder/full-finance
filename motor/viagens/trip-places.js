function folded(name) {
    return String(name ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
}

export function isHomeName(name) {
    const f = folded(name);
    if (!f) return false;
    if (f === 'rec') return true;
    return f.split(/[^a-z]+/).includes('recife');
}

export function isHomeDestination(destination) {
    return isHomeName(destination?.name);
}

function routeDay(destination) {
    const arrived = (destination.arrivedOn ?? '').trim();
    if (arrived) return arrived;
    const departed = (destination.departedOn ?? '').trim();
    return departed || null;
}

/** Destinos do roteiro sem casa, ordem por data de chegada. */
export function routeStops(destinations) {
    return (destinations ?? [])
        .map((element, index) => ({ element, index }))
        .filter(({ element }) => !isHomeDestination(element))
        .sort((lhs, rhs) => {
            const left = routeDay(lhs.element);
            const right = routeDay(rhs.element);
            if (left && right && left !== right) return left < right ? -1 : 1;
            return lhs.index - rhs.index;
        })
        .map(({ element }) => element);
}

export function principalDestination(destinations) {
    const stops = routeStops(destinations);
    return stops.find((d) => d.isPrincipal) ?? stops[0] ?? null;
}

export function placesSummary(destinations) {
    const stops = routeStops(destinations);
    const countries = [];
    const continents = [];
    const seenC = new Set();
    const seenCont = new Set();
    for (const dest of stops) {
        const country = (dest.country ?? '').trim();
        const continent = (dest.continent ?? '').trim();
        const fc = folded(country);
        if (country && !seenC.has(fc)) {
            seenC.add(fc);
            countries.push(country);
        }
        const fcont = folded(continent);
        if (continent && !seenCont.has(fcont)) {
            seenCont.add(fcont);
            continents.push(continent);
        }
    }
    const principal = principalDestination(destinations);
    const principalName = (principal?.name ?? '').trim() || 'Sem destino';
    const cityCount = stops.filter((d) => d.kind !== 'continent' && d.kind !== 'country').length;
    return { principalName, countries, continents, cityCount };
}

export function ensuringPrincipal(destinations) {
    const stops = routeStops(destinations);
    if (!stops.length) return destinations;
    if (destinations.some((d) => d.isPrincipal && !isHomeDestination(d))) return destinations;
    return destinations.map((d) => ({ ...d, isPrincipal: d.id === stops[0].id }));
}
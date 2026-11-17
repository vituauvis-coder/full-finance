import { api } from '../../api-client.js';

export function fetchTripsList() {
    return api('/api/trips');
}

export function fetchTrip(id) {
    return api(`/api/trips/${id}`);
}

export function createTrip(title) {
    return api('/api/trips', {
        method: 'POST',
        body: JSON.stringify({ title: title ?? 'Nova viagem' })
    });
}

export function saveTrip(id, body) {
    return api(`/api/trips/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

export function deleteTrip(id) {
    return api(`/api/trips/${id}`, { method: 'DELETE' });
}

export function geocodeSearch(q) {
    return api(`/api/trips/geocode/search?q=${encodeURIComponent(q)}`);
}

export function scenarioSnapshot(body) {
    return api('/api/trips/scenario/snapshot', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
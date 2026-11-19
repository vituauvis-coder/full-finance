import { fetchTripsList, createTrip } from './viagens-api.js';
import { renderTrilhoHtml, bindTrilho } from './viagens-trilho.js';
import { mountViagensMap, destroyViagensMap } from './viagens-map.js';
import { navigateViagensTrip } from './viagens-router.js';

export async function renderViagensCasa(host) {
    host.innerHTML = '<p class="viagens-muted">Carregando atlas…</p>';
    let data;
    try {
        data = await fetchTripsList();
    } catch (e) {
        host.innerHTML = `<p role="alert" class="viagens-alert">${escapeHtml(e.message)}</p>`;
        return { cleanup: () => {}, onNewTrip: null };
    }

    const trips = data.trips ?? [];
    const visits = data.visits ?? [];

    async function handleNew() {
        const { trip } = await createTrip();
        navigateViagensTrip(trip.id);
    }

    host.innerHTML = `
        <div class="viagens-root">
            <div class="viagens-casa-layout">
                <main class="viagens-casa-main">
                    <div id="viagens-map-host"></div>
                </main>
                ${renderTrilhoHtml(trips)}
            </div>
        </div>`;

    const mapHost = host.querySelector('#viagens-map-host');
    mountViagensMap(mapHost, {
        trips,
        visits,
        onOpenTrip: (id) => navigateViagensTrip(id)
    });

    bindTrilho(host, {
        onOpen: (id) => navigateViagensTrip(id),
        onNew: () => void handleNew()
    });

    return {
        cleanup: () => destroyViagensMap(),
        onNewTrip: handleNew
    };
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
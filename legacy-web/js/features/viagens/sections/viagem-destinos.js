import { geocodeSearch } from '../viagens-api.js';
import { itineraryDays } from '../../../../../motor/viagens/trips-engine.js';
import { routeStops } from '../../../../../motor/viagens/trip-places.js';
import { mountViagensMiniMap, destroyViagensMiniMap } from '../viagem-minimap.js';

export function renderDestinosSection(draft) {
    const dests = draft.payload?.destinations ?? [];
    const itinerary = draft.payload?.itinerary ?? [];
    const stops = routeStops(dests);
    return `
        <details class="viagens-secao">
            <summary class="viagens-secao__head"><span class="viagens-secao__dot viagens-secao__dot--coral"></span> Destinos & roteiro</summary>
            <div class="viagens-secao__body">
                <input class="viagens-field" id="viagens-geo-q" placeholder="País, cidade, aeroporto ou endereço">
                <button type="button" class="viagens-btn viagens-btn--ghost" id="viagens-geo-run">Buscar</button>
                <div id="viagens-geo-hits" class="viagens-geo-hits"></div>
                <div class="viagens-chips">${stops
                    .map(
                        (d, i) =>
                            `<span class="viagens-chip viagens-chip--${i % 3}">${i + 1}. ${escapeHtml(d.name)}</span>`
                    )
                    .join('')}</div>
                <div id="viagens-minimap-host" class="viagens-minimap-host"></div>
                <h4 class="viagens-subtitle">Roteiro</h4>
                <div class="viagens-itinerary">
                    ${itinerary
                        .slice(0, 14)
                        .map(
                            (day) => `
                        <div class="viagens-itinerary-day">
                            <strong>${day.dayKey ?? day.day_key}</strong>
                            <span class="viagens-muted">${(day.items ?? []).length} atividades</span>
                        </div>`
                        )
                        .join('')}
                </div>
                <button type="button" class="viagens-btn viagens-btn--ghost" id="viagens-sync-itinerary">Atualizar dias do roteiro</button>
            </div>
        </details>`;
}

export function bindDestinosSection(root, ctx) {
    const { patchDraft, scheduleSave, getDraft } = ctx;
    const mapHost = root.querySelector('#viagens-minimap-host');
    const draft = getDraft();
    mountViagensMiniMap(mapHost, {
        destinations: draft.payload?.destinations ?? [],
        onTap: (lat, lng) => {
            patchDraft((d) => ({
                ...d,
                payload: {
                    ...d.payload,
                    destinations: [
                        ...(d.payload.destinations ?? []),
                        { id: crypto.randomUUID(), name: 'Novo lugar', latitude: lat, longitude: lng }
                    ]
                }
            }));
            scheduleSave();
            root.dispatchEvent(new CustomEvent('viagens:rerender'));
        }
    });

    root.querySelector('#viagens-geo-run')?.addEventListener('click', async () => {
        const q = root.querySelector('#viagens-geo-q')?.value?.trim();
        if (!q || q.length < 2) return;
        const hitsEl = root.querySelector('#viagens-geo-hits');
        try {
            const { hits } = await geocodeSearch(q);
            hitsEl.innerHTML = hits
                .map(
                    (h) =>
                        `<button type="button" class="viagens-geo-hit" data-lat="${h.latitude}" data-lng="${h.longitude}" data-name="${escapeHtml(h.name)}" data-country="${escapeHtml(h.country)}">${escapeHtml(h.name)} · ${escapeHtml(h.country)}</button>`
                )
                .join('');
            hitsEl.querySelectorAll('.viagens-geo-hit').forEach((btn) => {
                btn.addEventListener('click', () => {
                    patchDraft((d) => ({
                        ...d,
                        payload: {
                            ...d.payload,
                            destinations: [
                                ...(d.payload.destinations ?? []),
                                {
                                    id: crypto.randomUUID(),
                                    name: btn.dataset.name,
                                    country: btn.dataset.country,
                                    latitude: Number(btn.dataset.lat),
                                    longitude: Number(btn.dataset.lng)
                                }
                            ]
                        }
                    }));
                    scheduleSave();
                    root.dispatchEvent(new CustomEvent('viagens:rerender'));
                });
            });
        } catch (e) {
            hitsEl.textContent = e.message;
        }
    });

    root.querySelector('#viagens-sync-itinerary')?.addEventListener('click', () => {
        const d = getDraft();
        const days = itineraryDays(d.startsOn, d.endsOn, d.payload?.itinerary ?? []);
        patchDraft((draft) => ({
            ...draft,
            payload: { ...draft.payload, itinerary: days }
        }));
        scheduleSave();
        root.dispatchEvent(new CustomEvent('viagens:rerender'));
    });

    return () => destroyViagensMiniMap();
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/>/g, '&gt;');
}
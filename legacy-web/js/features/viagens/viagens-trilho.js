import { formatTripDateRange } from './trip-dates.js';

function stampClass(status) {
    if (status === 'em_curso') return 'viagens-stamp--em_curso';
    if (status === 'realizada') return 'viagens-stamp--realizada';
    return 'viagens-stamp--planejada';
}

function statusLabel(s) {
    if (s === 'em_curso') return 'EM CURSO';
    if (s === 'realizada') return 'REALIZADA';
    return 'PLANEJADA';
}

function creatorLabel(trip) {
    const name = trip.creator?.name?.trim();
    if (name) return name;
    const email = trip.creator?.email?.trim();
    if (email) return email.split('@')[0] || email;
    return '';
}

function cityLine(trip) {
    return (trip.payload?.destinations ?? [])
        .map((d) => d.name?.trim())
        .filter(Boolean)
        .join(' · ');
}

export function renderTrilhoHtml(trips) {
    const cards =
        trips.length === 0
            ? '<p class="viagens-trail-empty">A primeira viagem nasce aqui</p>'
            : trips
                  .map((t, i) => {
                      const title = t.title?.trim() || 'Nova viagem';
                      const by = creatorLabel(t);
                      const cities = cityLine(t);
                      const frac = t.capUsedFraction ?? 0;
                      const over = frac > 1;
                      return `
            <button type="button" class="viagens-tag" data-trip-id="${t.id}" style="animation-delay:${i * 0.06}s">
                <div class="viagens-tag__row">
                    <h3 class="viagens-tag__title">${escapeHtml(title)}</h3>
                    <span class="viagens-stamp ${stampClass(t.effectiveStatus)}">${statusLabel(t.effectiveStatus)}</span>
                </div>
                <p class="viagens-tag__meta">${formatTripDateRange(t.startsOn, t.endsOn)}${by ? ` · ${escapeHtml(by)}` : ''}</p>
                ${cities ? `<p class="viagens-tag__meta">${escapeHtml(cities)}</p>` : ''}
                <div class="viagens-cap-bar" role="progressbar" aria-valuenow="${Math.round(Math.min(100, frac * 100))}">
                    <div class="viagens-cap-bar__fill ${over ? 'viagens-cap-bar__fill--over' : ''}"
                        style="width:${Math.min(100, frac * 100)}%"></div>
                </div>
            </button>`;
                  })
                  .join('');
    return `
        <aside class="viagens-casa__trail" aria-label="Trilho de viagens">
            <div class="viagens-trail-header">
                <h2>Viagens</h2>
                <button type="button" class="viagens-btn viagens-btn--ghost viagens-trail-new" id="viagens-btn-new">Nova viagem</button>
            </div>
            <div class="viagens-trail-scroll">${cards}</div>
        </aside>`;
}

export function bindTrilho(root, { onOpen, onNew }) {
    root.querySelector('#viagens-btn-new')?.addEventListener('click', () => onNew());
    root.querySelectorAll('[data-trip-id]').forEach((btn) => {
        btn.addEventListener('click', () => onOpen(btn.dataset.tripId));
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
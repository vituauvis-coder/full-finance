import { formatBRL } from '../map-utils.js';
import { flightCompare } from '../../../../../motor/viagens/trips-engine.js';

export function renderVoosSection(draft) {
    const segments = draft.payload?.flight_segments ?? draft.payload?.flightSegments ?? [];
    return `
        <details class="viagens-secao">
            <summary class="viagens-secao__head"><span class="viagens-secao__dot viagens-secao__dot--turquesa"></span> Voos</summary>
            <div class="viagens-secao__body">
                ${segments.length === 0 ? '<p class="viagens-muted">Nenhum trecho aéreo</p>' : ''}
                ${segments
                    .map((seg) => {
                        const sims = seg.simulations ?? [];
                        const stats = flightCompare(sims);
                        return `
                    <div class="viagens-voo-block" data-seg-id="${seg.id}">
                        <h4>${escapeHtml(seg.title ?? 'Trecho')}</h4>
                        <div class="viagens-kpi-grid viagens-kpi-grid--compact">
                            <div class="viagens-kpi"><span>Menor custo</span><strong>${stats.cheapestFinal != null ? formatBRL(stats.cheapestFinal) : '—'}</strong></div>
                            <div class="viagens-kpi"><span>Média</span><strong>${stats.averageFinal != null ? formatBRL(stats.averageFinal) : '—'}</strong></div>
                            <div class="viagens-kpi"><span>Melhor hub</span><strong>${escapeHtml(stats.cheapestHub ?? '—')}</strong></div>
                            <div class="viagens-kpi"><span>Opções</span><strong>${stats.mappedCount}</strong></div>
                        </div>
                        ${sims
                            .map(
                                (s) => `
                            <div class="viagens-sim-card" data-sim-id="${s.id}">
                                <span class="viagens-stamp viagens-stamp--planejada">${s.status === 'descartada' ? 'DESCARTADA' : 'CANDIDATA'}</span>
                                <p>${escapeHtml(s.destination ?? s.title ?? 'Simulação')}</p>
                                <strong>${formatBRL(Number(s.finalCost ?? Number(s.amount ?? 0) + Number(s.extrasAmount ?? 0)))}</strong>
                                <button type="button" class="viagens-btn viagens-btn--ghost" data-sim-del>✕</button>
                            </div>`
                            )
                            .join('')}
                        <button type="button" class="viagens-btn viagens-btn--ghost" data-add-sim>+ Nova simulação</button>
                    </div>`;
                    })
                    .join('')}
                <button type="button" class="viagens-btn viagens-btn--coral" id="viagens-add-segment">+ Trecho</button>
            </div>
        </details>`;
}

export function bindVoosSection(root, ctx) {
    const { patchDraft, scheduleSave } = ctx;
    root.querySelector('#viagens-add-segment')?.addEventListener('click', () => {
        patchDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                flight_segments: [
                    ...(d.payload.flight_segments ?? d.payload.flightSegments ?? []),
                    { id: crypto.randomUUID(), title: 'Novo trecho', simulations: [] }
                ]
            }
        }));
        scheduleSave();
        root.dispatchEvent(new CustomEvent('viagens:rerender'));
    });
    root.querySelectorAll('[data-add-sim]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const segId = btn.closest('[data-seg-id]')?.dataset.segId;
            patchDraft((d) => ({
                ...d,
                payload: {
                    ...d.payload,
                    flight_segments: (d.payload.flight_segments ?? []).map((seg) =>
                        seg.id === segId
                            ? {
                                  ...seg,
                                  simulations: [
                                      ...(seg.simulations ?? []),
                                      {
                                          id: crypto.randomUUID(),
                                          status: 'candidata',
                                          amount: 0,
                                          extrasAmount: 0,
                                          destination: 'Destino'
                                      }
                                  ]
                              }
                            : seg
                    )
                }
            }));
            scheduleSave();
            root.dispatchEvent(new CustomEvent('viagens:rerender'));
        });
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
import { fetchTrip, deleteTrip } from './viagens-api.js';
import { createTripPersistor } from './viagem-persist.js';
import { formatBRL } from './map-utils.js';
import { tripTotal } from '../../../../motor/viagens/trips-engine.js';
import { formatTripDateRange } from './trip-dates.js';
import { renderTripCalendarCard } from './viagem-calendario.js';
import { renderVoosSection, bindVoosSection } from './sections/viagem-voos.js';
import { renderOrcamentoSection, bindOrcamentoSection } from './sections/viagem-orcamento.js';
import { renderDestinosSection, bindDestinosSection } from './sections/viagem-destinos.js';
import { renderHospedagensSection, bindHospedagensSection } from './sections/viagem-hospedagens.js';
import { openSimuladorOverlay } from './sections/viagem-simulador.js';
import { navigateViagensHome } from './viagens-router.js';
import { showToast } from '../../shell/app-shell.js';

function emptyPayload() {
    return {
        destinations: [],
        expenses: [],
        stays: [],
        itinerary: [],
        legs: [],
        documents: [],
        checks: [],
        flight_segments: [],
        time_scenarios: [],
        budget_custom_categories: []
    };
}

function tripToDraft(trip) {
    return {
        title: trip.title ?? 'Nova viagem',
        startsOn: trip.startsOn ?? '',
        endsOn: trip.endsOn ?? '',
        statusOverride: trip.statusOverride ?? '',
        budgetCaps: { ...(trip.budgetCaps ?? {}) },
        payload: { ...emptyPayload(), ...(trip.payload ?? {}) }
    };
}

function statusLabel(s) {
    if (s === 'em_curso') return 'Em curso';
    if (s === 'realizada') return 'Realizada';
    return 'Planejada';
}

function renderTopRow(draft, trip) {
    const checks = draft.payload.checks ?? [];
    const done = checks.filter((c) => c.done || c.completed).length;
    const goal = Number(draft.payload.tripGoal ?? draft.payload.trip_goal ?? 0);
    const piggy = Number(draft.payload.piggyBank ?? draft.payload.piggy_bank ?? 0);
    const spentVal = tripTotal({ payload: draft.payload, budgetCaps: draft.budgetCaps });
    const savePct = goal > 0 ? Math.min(100, Math.round((piggy / goal) * 100)) : 0;

    return `
        <div class="viagens-ficha-top">
            ${renderTripCalendarCard(draft)}
            <article class="viagens-panel viagens-panel--resumo" aria-label="Resumo da viagem">
                <header class="viagens-panel__head">
                    <h3 class="viagens-panel__title">Resumo</h3>
                    <span class="viagens-muted">${trip.cityCount ?? 0} destinos</span>
                </header>
                <p class="viagens-resumo__dates">${formatTripDateRange(draft.startsOn, draft.endsOn)}</p>
                <div class="viagens-kpi-grid viagens-kpi-grid--compact">
                    <div class="viagens-kpi"><span>Meta</span><strong>${formatBRL(goal)}</strong></div>
                    <div class="viagens-kpi"><span>Cofrinho</span><strong class="viagens-kpi--turquesa">${formatBRL(piggy)}</strong></div>
                    <div class="viagens-kpi"><span>Gastos</span><strong>${formatBRL(spentVal)}</strong></div>
                </div>
                ${
                    goal > 0
                        ? `<div class="viagens-cap-bar" role="progressbar" aria-valuenow="${savePct}" aria-label="Progresso do cofrinho">
                    <div class="viagens-cap-bar__fill" style="width:${savePct}%"></div>
                </div>
                <p class="viagens-panel__foot viagens-muted">Falta juntar ${formatBRL(Math.max(0, goal - piggy))}</p>`
                        : ''
                }
            </article>
            <article class="viagens-panel viagens-panel--checklist" aria-label="Checklist">
                <header class="viagens-panel__head">
                    <h3 class="viagens-panel__title">Checklist</h3>
                    <span class="viagens-badge viagens-badge--soft">${done}/${checks.length || 0}</span>
                </header>
                <div class="viagens-checklist__list">
                ${checks
                    .map(
                        (c) => `
                    <label class="viagens-check-row" data-check-id="${c.id}">
                        <input type="checkbox" ${c.done || c.completed ? 'checked' : ''}>
                        <span>${escapeHtml(c.title ?? 'Item')}</span>
                    </label>`
                    )
                    .join('')}
                ${checks.length === 0 ? '<p class="viagens-muted viagens-checklist__empty">Nada por aqui ainda</p>' : ''}
                </div>
                <button type="button" class="viagens-btn viagens-btn--ghost viagens-btn--sm viagens-checklist__add" id="viagens-add-check">+ Adicionar item</button>
            </article>
        </div>`;
}

function renderAccordionSections(draft) {
    return `
        <div class="viagens-ficha-accordion">
            ${renderVoosSection(draft)}
            ${renderOrcamentoSection(draft)}
            ${renderDestinosSection(draft)}
            ${renderHospedagensSection(draft)}
        </div>`;
}

export async function renderViagemFicha(host, tripId) {
    let cleanupDestinos = () => {};
    let persistor = null;
    let draft = null;
    let serverPayload = {};
    let scenarioWinnerId = null;
    let trip = null;
    let rerenderBound = false;

    host.innerHTML = '<p class="viagens-muted">Carregando ficha…</p>';

    try {
        const data = await fetchTrip(tripId);
        trip = data.trip;
        scenarioWinnerId = data.scenarioWinnerId ?? null;
        serverPayload = trip.payload ?? {};
        draft = tripToDraft(trip);
    } catch (e) {
        host.innerHTML = `<p role="alert">${escapeHtml(e.message)}</p>`;
        return () => {};
    }

    function getDraft() {
        return draft;
    }

    function patchDraft(fn) {
        draft = fn(draft);
    }

    function scheduleSave() {
        persistor?.schedule(serverPayload);
    }

    function syncChrome() {
        const status = trip?.effectiveStatus ?? 'planejada';
        const pill = host.querySelector('.viagens-status-pill');
        if (pill) {
            pill.className = `viagens-status-pill viagens-status-pill--${status}`;
            pill.textContent = statusLabel(status);
        }
        const simBadge = host.querySelector('#viagens-open-sim .viagens-badge');
        if (simBadge) {
            simBadge.textContent = String((draft.payload.time_scenarios ?? []).length);
        }
    }

    function paint() {
        const top = renderTopRow(draft, trip);
        const accordion = renderAccordionSections(draft);

        const shell = host.querySelector('.viagens-ficha-shell');
        if (shell) {
            shell.querySelector('.viagens-ficha__top').innerHTML = top;
            shell.querySelector('.viagens-ficha__sections').innerHTML = accordion;
            syncChrome();
            bindAll();
            return;
        }

        const status = trip.effectiveStatus ?? 'planejada';
        const scenarioCount = (draft.payload.time_scenarios ?? []).length;

        host.innerHTML = `
            <div class="viagens-root">
                <div class="viagens-ficha viagens-ficha-shell">
                    <header class="viagens-ficha__header">
                        <div class="viagens-ficha__toolbar">
                            <button type="button" class="viagens-btn viagens-btn--ghost viagens-btn--sm" id="viagens-back-atlas">
                                <i class="fas fa-chevron-left" aria-hidden="true"></i> Voltar
                            </button>
                            <input class="viagens-ficha__title" id="viagens-title" value="${escapeHtml(draft.title)}" aria-label="Título">
                            <div class="viagens-ficha__actions">
                                <span class="viagens-status-pill viagens-status-pill--${status}">${statusLabel(status)}</span>
                                <button type="button" class="viagens-btn viagens-btn--ghost viagens-btn--sm" id="viagens-open-sim">
                                    Simulador <span class="viagens-badge">${scenarioCount}</span>
                                </button>
                                <button type="button" class="viagens-btn viagens-btn--ghost viagens-btn--icon" id="viagens-delete-trip" title="Apagar viagem" aria-label="Apagar viagem">
                                    <i class="fas fa-trash" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </header>
                    <div class="viagens-ficha__top">${top}</div>
                    <div class="viagens-ficha__sections">${accordion}</div>
                </div>
            </div>`;
        bindChrome();
        bindAll();
    }

    function bindChrome() {
        host.querySelector('#viagens-back-atlas')?.addEventListener('click', () => navigateViagensHome());
        host.querySelector('#viagens-title')?.addEventListener('input', (e) => {
            patchDraft((d) => ({ ...d, title: e.target.value }));
            scheduleSave();
        });
        host.querySelector('#viagens-delete-trip')?.addEventListener('click', async () => {
            if (!window.confirm('Apagar esta viagem?')) return;
            await deleteTrip(tripId);
            navigateViagensHome();
        });
        host.querySelector('#viagens-open-sim')?.addEventListener('click', () => {
            openSimuladorOverlay(host, {
                getDraft,
                patchDraft,
                scheduleSave,
                scenarioWinnerId,
                onClose: () => paint()
            });
        });
    }

    function bindAll() {
        const sections = host.querySelector('.viagens-ficha__sections');
        const top = host.querySelector('.viagens-ficha__top');
        if (!sections || !top) return;
        cleanupDestinos();
        cleanupDestinos = bindDestinosSection(sections, { getDraft, patchDraft, scheduleSave }) || (() => {});
        bindVoosSection(sections, { getDraft, patchDraft, scheduleSave });
        bindOrcamentoSection(sections, { getDraft, patchDraft, scheduleSave });
        bindHospedagensSection(sections, { getDraft, patchDraft, scheduleSave });

        const onDateChange = (field, value) => {
            patchDraft((d) => ({ ...d, [field]: value }));
            scheduleSave();
            paint();
        };
        top.querySelector('[data-field-starts]')?.addEventListener('change', (e) => onDateChange('startsOn', e.target.value));
        top.querySelector('[data-field-ends]')?.addEventListener('change', (e) => onDateChange('endsOn', e.target.value));

        top.querySelector('#viagens-add-check')?.addEventListener('click', () => {
            patchDraft((d) => ({
                ...d,
                payload: {
                    ...d.payload,
                    checks: [...(d.payload.checks ?? []), { id: crypto.randomUUID(), title: 'Novo item', done: false }]
                }
            }));
            scheduleSave();
            paint();
        });
        top.querySelectorAll('[data-check-id]').forEach((row) => {
            row.querySelector('input')?.addEventListener('change', (e) => {
                const id = row.dataset.checkId;
                patchDraft((d) => ({
                    ...d,
                    payload: {
                        ...d.payload,
                        checks: (d.payload.checks ?? []).map((c) => (c.id === id ? { ...c, done: e.target.checked } : c))
                    }
                }));
                scheduleSave();
            });
        });
        if (!rerenderBound) {
            host.addEventListener('viagens:rerender', () => paint());
            rerenderBound = true;
        }
    }

    persistor = createTripPersistor({
        tripId,
        getDraft,
        onSaving: () => {},
        onSaved: (saved, payload) => {
            trip = saved;
            serverPayload = payload ?? saved.payload ?? {};
            syncChrome();
        },
        onError: (e) => {
            showToast('Viagem', e.message || 'Falha ao salvar', 'error');
        }
    });

    paint();

    return () => {
        persistor?.dispose();
        cleanupDestinos();
    };
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
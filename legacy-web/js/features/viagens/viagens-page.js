import { renderViagensCasa } from './viagens-casa.js';
import { renderViagemFicha } from './viagem-ficha.js';
import {
    parseViagensRoute,
    navigateViagensHome,
    navigateViagensTrip,
    setViagensRouteHandler
} from './viagens-router.js';

export { navigateViagensHome, navigateViagensTrip };

let cleanup = () => {};
let newTripListener = null;

async function routeViagens() {
    const host = document.getElementById('viagens-root');
    if (!host) return;
    cleanup();
    const route = parseViagensRoute();
    const headerActions = document.getElementById('viagens-header-actions');
    if (headerActions) {
        headerActions.classList.toggle('hidden', route.view !== 'home');
    }
  if (newTripListener) {
        window.removeEventListener('viagens:new-trip', newTripListener);
        newTripListener = null;
    }
    if (route.view === 'trip') {
        cleanup = await renderViagemFicha(host, route.tripId);
    } else {
        const result = await renderViagensCasa(host);
        cleanup = result.cleanup;
        if (result.onNewTrip) {
            newTripListener = () => void result.onNewTrip();
            window.addEventListener('viagens:new-trip', newTripListener);
        }
    }
}

export function initViagens() {
    setViagensRouteHandler(() => {
        void routeViagens();
    });
    const headerBtn = document.getElementById('viagens-header-new-btn');
    if (headerBtn && !headerBtn.dataset.viagensBound) {
        headerBtn.dataset.viagensBound = '1';
        headerBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('viagens:new-trip'));
        });
    }
    window.addEventListener('hashchange', () => {
        const page = document.getElementById('viagens-page');
        if (page && !page.classList.contains('hidden')) {
            void routeViagens();
        }
    });
}

const REACT_VIAGENS_CUTOVER = () => localStorage.getItem('meu-mundo:viagens-react') === '1';
const REACT_FRONT_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_REACT_FRONT_URL
    ? String(import.meta.env.VITE_REACT_FRONT_URL)
    : 'http://localhost:5174';

export function loadViagensPage() {
    if (REACT_VIAGENS_CUTOVER()) {
        const trip = window.location.hash.match(/^#viagens\/([^/]+)/)?.[1];
        const path = trip ? `/viagens/${trip}` : '/viagens';
        window.location.href = `${REACT_FRONT_URL.replace(/\/$/, '')}${path}`;
        return;
    }
    if (!window.location.hash.startsWith('#viagens')) {
        window.location.hash = '#viagens';
    }
    void routeViagens();
}

export function teardownViagensPage() {
    cleanup();
    cleanup = () => {};
    if (newTripListener) {
        window.removeEventListener('viagens:new-trip', newTripListener);
        newTripListener = null;
    }
}
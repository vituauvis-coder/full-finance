/** Tooltip estilizado para ícones dos cards de resumo (substitui o title nativo do browser). */

const CARD_ICON_SELECTOR = '.movements-summary-card-icon';
const SHOW_DELAY_MS = 220;
const HIDE_DELAY_MS = 100;
const TONE_CLASSES = ['expense', 'income', 'balance', 'projection', 'investments', 'savings', 'cofrinhos'];

let tipEl = null;
let kickerEl = null;
let textEl = null;
let showTimer = null;
let hideTimer = null;
let activeAnchor = null;

function ensureTipEl() {
    if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.className = 'portal-tooltip';
        tipEl.setAttribute('role', 'tooltip');
        tipEl.innerHTML = `
            <div class="portal-tooltip__inner">
                <span class="portal-tooltip__accent" aria-hidden="true"></span>
                <div class="portal-tooltip__body">
                    <span class="portal-tooltip__kicker"></span>
                    <p class="portal-tooltip__text"></p>
                </div>
            </div>`;
        document.body.appendChild(tipEl);
        kickerEl = tipEl.querySelector('.portal-tooltip__kicker');
        textEl = tipEl.querySelector('.portal-tooltip__text');
    }
    return tipEl;
}

function clearTimers() {
    if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
    }
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
}

function toneFromAnchor(anchor) {
    for (const tone of TONE_CLASSES) {
        if (anchor.classList.contains(tone)) return tone;
    }
    return 'balance';
}

function kickerFromAnchor(anchor) {
    const card = anchor.closest('.card');
    const title = card?.querySelector('.card-content h3')?.textContent?.trim();
    return title || 'Sobre este indicador';
}

function setAnchorActive(anchor, on) {
    if (!anchor) return;
    anchor.classList.toggle('portal-tooltip-active', on);
}

function hideTooltip() {
    clearTimers();
    setAnchorActive(activeAnchor, false);
    activeAnchor = null;
    if (!tipEl) return;
    tipEl.classList.remove('portal-tooltip--visible');
    tipEl.removeAttribute('data-placement');
    tipEl.removeAttribute('data-tone');
}

function positionTooltip(anchor, placement) {
    const tip = ensureTipEl();
    const rect = anchor.getBoundingClientRect();
    const gap = 12;
    const pad = 14;
    const tipRect = tip.getBoundingClientRect();
    let top;
    let left;

    if (placement === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else {
        top = rect.top - gap - tipRect.height;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
    }

    left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad));
    if (top < pad) {
        top = rect.bottom + gap;
        placement = 'bottom';
    } else if (top + tipRect.height > window.innerHeight - pad) {
        top = rect.top - gap - tipRect.height;
        placement = 'top';
    }

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.setAttribute('data-placement', placement);

    const anchorCenter = rect.left + rect.width / 2;
    const tipLeft = parseFloat(tip.style.left) || 0;
    const arrowOffset = Math.max(18, Math.min(tipRect.width - 18, anchorCenter - tipLeft));
    tip.style.setProperty('--portal-tooltip-arrow-x', `${Math.round(arrowOffset)}px`);
}

function showTooltip(anchor) {
    const text = anchor.getAttribute('data-portal-tooltip')?.trim();
    if (!text) return;

    clearTimers();
    setAnchorActive(activeAnchor, false);
    activeAnchor = anchor;
    setAnchorActive(anchor, true);

    const tip = ensureTipEl();
    const tone = toneFromAnchor(anchor);
    tip.setAttribute('data-tone', tone);
    kickerEl.textContent = kickerFromAnchor(anchor);
    textEl.textContent = text;

    tip.classList.remove('portal-tooltip--visible');
    tip.style.visibility = 'hidden';
    tip.style.top = '0';
    tip.style.left = '0';

    requestAnimationFrame(() => {
        if (activeAnchor !== anchor) return;
        let placement = 'top';
        positionTooltip(anchor, placement);
        const rect = anchor.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        if (rect.top - tipRect.height - 12 < 14) {
            placement = 'bottom';
            positionTooltip(anchor, placement);
        }
        tip.style.visibility = '';
        tip.classList.add('portal-tooltip--visible');
    });
}

function onPointerEnter(e) {
    const anchor = e.currentTarget;
    if (!anchor.getAttribute('data-portal-tooltip')?.trim()) return;

    clearTimers();
    hideTimer = null;
    showTimer = setTimeout(() => showTooltip(anchor), SHOW_DELAY_MS);
}

function onPointerLeave(e) {
    const anchor = e.currentTarget;
    clearTimers();
    showTimer = null;
    hideTimer = setTimeout(() => {
        if (activeAnchor === anchor) hideTooltip();
    }, HIDE_DELAY_MS);
}

function onFocusIn(e) {
    onPointerEnter(e);
}

function onFocusOut(e) {
    onPointerLeave(e);
}

function bindElement(el) {
    if (el.dataset.portalTooltipBound === '1') return;
    el.dataset.portalTooltipBound = '1';
    el.classList.add('has-portal-tooltip');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', onPointerEnter);
    el.addEventListener('mouseleave', onPointerLeave);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
}

function unbindElement(el) {
    if (el.dataset.portalTooltipBound !== '1') return;
    delete el.dataset.portalTooltipBound;
    el.classList.remove('has-portal-tooltip', 'portal-tooltip-active');
    el.removeAttribute('tabindex');
    el.removeEventListener('mouseenter', onPointerEnter);
    el.removeEventListener('mouseleave', onPointerLeave);
    el.removeEventListener('focusin', onFocusIn);
    el.removeEventListener('focusout', onFocusOut);
    if (activeAnchor === el) hideTooltip();
}

/** Lê title ou data-portal-tooltip e prepara o elemento para o tooltip customizado. */
export function syncPortalTooltip(el) {
    if (!el?.matches?.(CARD_ICON_SELECTOR)) return;

    const fromTitle = el.getAttribute('title')?.trim() || '';
    const fromData = el.getAttribute('data-portal-tooltip')?.trim() || '';
    const text = fromTitle || fromData;

    if (fromTitle) {
        el.setAttribute('data-portal-tooltip', fromTitle);
        el.removeAttribute('title');
    } else if (text) {
        el.setAttribute('data-portal-tooltip', text);
    } else {
        el.removeAttribute('data-portal-tooltip');
        unbindElement(el);
        return;
    }

    bindElement(el);
}

export function initPortalTooltips() {
    document.querySelectorAll(CARD_ICON_SELECTOR).forEach(syncPortalTooltip);

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'title' && m.target.matches?.(CARD_ICON_SELECTOR)) {
                syncPortalTooltip(m.target);
            }
            if (m.type === 'childList') {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches?.(CARD_ICON_SELECTOR)) syncPortalTooltip(node);
                    node.querySelectorAll?.(CARD_ICON_SELECTOR).forEach(syncPortalTooltip);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title']
    });

    window.addEventListener(
        'scroll',
        () => {
            if (activeAnchor && tipEl?.classList.contains('portal-tooltip--visible')) {
                positionTooltip(activeAnchor, tipEl.getAttribute('data-placement') || 'top');
            }
        },
        true
    );
}

import {
    MANAGED_SCREEN_ACCENT_CSS_VARS,
    buildScreenAccentCssProperties,
    getScreenAccentPreferences
} from '@motor/dinheiro/screen-accent-colors.js';
import type { UserProfile } from '../lib/types/finance';

let appliedVars: string[] = [];

function clearAppliedScreenAccentVars(el: HTMLElement) {
    const toClear = appliedVars.length ? appliedVars : MANAGED_SCREEN_ACCENT_CSS_VARS;
    for (const key of toClear) {
        el.style.removeProperty(key);
    }
    appliedVars = [];
}

export function applyScreenAccentCssProperties(props: Record<string, string>) {
    const el = document.documentElement;
    clearAppliedScreenAccentVars(el);
    for (const [key, value] of Object.entries(props)) {
        el.style.setProperty(key, value);
        appliedVars.push(key);
    }
}

export function applyScreenAccentsFromProfile(userProfile: UserProfile | null | undefined) {
    const prefs = getScreenAccentPreferences(userProfile ?? null);
    applyScreenAccentCssProperties(buildScreenAccentCssProperties(prefs));
}
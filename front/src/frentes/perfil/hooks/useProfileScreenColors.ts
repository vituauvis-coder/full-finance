import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DEFAULT_SCREEN_ACCENTS,
    SCREEN_ACCENT_KEYS,
    SCREEN_ACCENT_LABELS,
    SCREEN_ACCENT_QUICK_PICKS,
    SCREEN_ACCENT_THEME_PRESETS,
    buildScreenAccentCssProperties,
    getScreenAccentOverrides,
    getScreenAccentPreferences,
    sanitizeScreenAccentPatch
} from '@motor/dinheiro/screen-accent-colors.js';
import type { ScreenAccentKey } from '../../../lib/types/profile';
import { applyScreenAccentCssProperties, applyScreenAccentsFromProfile } from '../../../app/screenAccents';
import { patchProfile } from '../api/profileApi';
import type { ProfileUser } from '../types/profile';
import { notifyProfileUpdated } from '../../../lib/profileEvents';
import { playPingSound } from '../../../app/uiSounds';

export {
    SCREEN_ACCENT_KEYS,
    SCREEN_ACCENT_LABELS,
    SCREEN_ACCENT_QUICK_PICKS,
    SCREEN_ACCENT_THEME_PRESETS,
    DEFAULT_SCREEN_ACCENTS
};

export function useProfileScreenColors(profile: ProfileUser | null, setProfile: (next: ProfileUser) => void) {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const resolved = useMemo(() => getScreenAccentPreferences(profile), [profile]);
    const [draft, setDraft] = useState<Record<ScreenAccentKey, string>>(() => ({ ...resolved }));

    useEffect(() => {
        setDraft({ ...resolved });
    }, [resolved]);

    const previewDraft = useCallback((next: Record<ScreenAccentKey, string>) => {
        applyScreenAccentCssProperties(buildScreenAccentCssProperties(next));
    }, []);

    const setScreenColor = (key: ScreenAccentKey, hex: string) => {
        setDraft((prev) => {
            const next = { ...prev, [key]: hex };
            previewDraft(next);
            return next;
        });
    };

    const resetScreenColor = (key: ScreenAccentKey) => {
        setDraft((prev) => {
            const next = { ...prev, [key]: DEFAULT_SCREEN_ACCENTS[key] };
            previewDraft(next);
            return next;
        });
    };

    const resetAll = () => {
        const next = { ...DEFAULT_SCREEN_ACCENTS };
        setDraft(next);
        previewDraft(next);
    };

    const applyThemePreset = (presetId: string) => {
        const preset = SCREEN_ACCENT_THEME_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        const next = { ...DEFAULT_SCREEN_ACCENTS, ...preset.accents };
        setDraft(next);
        previewDraft(next);
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        const prevOverrides = getScreenAccentOverrides(profile);
        const overrides: Record<string, string | null> = {};
        for (const key of SCREEN_ACCENT_KEYS) {
            if (draft[key] !== DEFAULT_SCREEN_ACCENTS[key]) {
                overrides[key] = draft[key];
            } else if (key in prevOverrides) {
                overrides[key] = null;
            }
        }
        const patch = sanitizeScreenAccentPatch(overrides);
        try {
            const updated = await patchProfile({
                financePreferences: { screenAccents: patch }
            });
            setProfile(updated);
            applyScreenAccentsFromProfile(updated);
            notifyProfileUpdated(updated);
            const kept = getScreenAccentOverrides(updated);
            const hasCustom = Object.keys(kept).length > 0;
            setMessage(hasCustom ? 'Cores das telas salvas.' : 'Cores restauradas ao padrão.');
            playPingSound();
        } catch {
            setMessage('Não foi possível salvar as cores.');
            applyScreenAccentsFromProfile(profile);
            setDraft({ ...getScreenAccentPreferences(profile) });
        } finally {
            setSaving(false);
        }
    };

    const dirty = SCREEN_ACCENT_KEYS.some((key) => draft[key] !== resolved[key]);
    const dirtyRef = useRef(dirty);
    const profileRef = useRef(profile);
    dirtyRef.current = dirty;
    profileRef.current = profile;

    useEffect(() => {
        return () => {
            if (dirtyRef.current) {
                applyScreenAccentsFromProfile(profileRef.current);
            }
        };
    }, []);

    return {
        draft,
        dirty,
        saving,
        message,
        setScreenColor,
        resetScreenColor,
        resetAll,
        applyThemePreset,
        save
    };
}
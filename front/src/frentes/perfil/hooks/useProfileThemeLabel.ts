import { useEffect, useState } from 'react';
import { readTheme } from '../../../app/theme';
import { profileThemeLabel } from '@motor/conta/profile-rules.js';

const THEME_CHANGE_EVENT = 'meumundo-themechange';

export function useProfileThemeLabel() {
    const [themeLabel, setThemeLabel] = useState(() => profileThemeLabel(readTheme()));

    useEffect(() => {
        const sync = () => setThemeLabel(profileThemeLabel(readTheme()));
        window.addEventListener(THEME_CHANGE_EVENT, sync);
        return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
    }, []);

    return themeLabel;
}
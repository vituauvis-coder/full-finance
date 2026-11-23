import { useEffect, useRef, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    dark: boolean;
};

export function SidebarThemeToggleIcon({ dark }: Props) {
    const [animating, setAnimating] = useState(false);
    const prevDark = useRef(dark);

    useEffect(() => {
        if (prevDark.current === dark) return;
        prevDark.current = dark;
        setAnimating(true);
        const timer = window.setTimeout(() => setAnimating(false), 520);
        return () => window.clearTimeout(timer);
    }, [dark]);

    return (
        <span className={`sidebar-theme-toggle__glyphs${animating ? ' is-animating' : ''}`} aria-hidden="true">
            <span className={`sidebar-theme-toggle__glyph${dark ? ' is-visible' : ''}`}>
                <MaterialIcon name="dark_mode" variant="app" opticalSize={22} filled={false} weight={500} />
            </span>
            <span className={`sidebar-theme-toggle__glyph${!dark ? ' is-visible' : ''}`}>
                <MaterialIcon name="light_mode" variant="app" opticalSize={22} filled={false} weight={500} />
            </span>
        </span>
    );
}
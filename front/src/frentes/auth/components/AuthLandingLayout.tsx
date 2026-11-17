import { type ReactNode, useCallback, useEffect } from 'react';
import { AppBrand, applyBrandToDocument } from '../../../app/appBrand';
import { AuthFeaturesSection } from './AuthFeaturesSection';
import { AuthHeroColumn } from './AuthHeroColumn';

type Props = {
    ariaLabel: string;
    children: ReactNode;
};

export function AuthLandingLayout({ ariaLabel, children }: Props) {
    useEffect(() => {
        applyBrandToDocument();
    }, []);

    const scrollToFeatures = useCallback(() => {
        document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    return (
        <div className="auth-container auth-container--modern">
            <section className="landing-hero landing-hero--split" aria-label={ariaLabel}>
                <div className="hero-bg-layer" aria-hidden="true" />
                <div className="auth-hero-grid" aria-hidden="true" />
                <div className="hero-orbs" aria-hidden="true">
                    <span className="hero-orb hero-orb--1" />
                    <span className="hero-orb hero-orb--2" />
                    <span className="hero-orb hero-orb--3" />
                </div>
                <div className="landing-hero-inner">
                    <AuthHeroColumn onExploreFeatures={scrollToFeatures} />
                    <div id="auth-section" className="hero-auth-panel">
                        {children}
                    </div>
                </div>
            </section>
            <AuthFeaturesSection />
            <footer className="landing-footer">
                <p>
                    Criado por <strong>Victor Alves</strong>
                </p>
                <p className="footer-version" data-app-brand="footer-version">
                    {AppBrand.NAME} v{AppBrand.VERSION}
                </p>
            </footer>
        </div>
    );
}
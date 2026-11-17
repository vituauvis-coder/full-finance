import { AppBrand } from '../../../app/appBrand';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { AUTH_FEATURES } from '../content';

export function AuthFeaturesSection() {
    return (
        <section id="features-section" className="landing-features">
            <h2 data-app-brand="why-heading">Por que usar {AppBrand.NAME}?</h2>
            <div className="features-grid">
                {AUTH_FEATURES.map((f) => (
                    <article key={f.title} className="feature-card">
                        <div className="feature-icon">
                            <MaterialIcon name={f.icon} className="feature-card__icon" />
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
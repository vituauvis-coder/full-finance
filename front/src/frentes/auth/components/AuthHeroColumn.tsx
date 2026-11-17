import { AppBrand } from '../../../app/appBrand';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { AUTH_HERO_LEAD, AUTH_HERO_POINTS } from '../content';

type Props = {
    onExploreFeatures: () => void;
};

export function AuthHeroColumn({ onExploreFeatures }: Props) {
    return (
        <div className="hero-content hero-content--left">
            <div className="hero-intro">
                <h1 className="hero-title">
                    <span className="hero-title-gradient" data-app-brand="name">
                        {AppBrand.NAME}
                    </span>
                </h1>
                <p className="hero-lead">{AUTH_HERO_LEAD}</p>
            </div>
            <ul className="hero-points" aria-label="Principais benefícios">
                {AUTH_HERO_POINTS.map((text) => (
                    <li key={text}>
                                <MaterialIcon name="check_circle" className="hero-points__icon" />
                        <span>{text}</span>
                    </li>
                ))}
            </ul>
            <div className="hero-buttons hero-buttons--split">
                <button type="button" className="btn-hero-secondary" onClick={onExploreFeatures}>
                    Explorar recursos <MaterialIcon name="south" className="btn-hero-icon" />
                </button>
            </div>
        </div>
    );
}
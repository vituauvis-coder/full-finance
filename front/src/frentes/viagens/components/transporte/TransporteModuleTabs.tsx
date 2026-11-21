import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    tripId: string;
};

const TABS = [
    { id: 'voos', segment: 'voos', label: 'Voos', icon: 'flight', tone: 'turquesa' as const },
    { id: 'terrestre', segment: 'terrestre', label: 'Terrestre', icon: 'directions_car', tone: 'oceano' as const }
];

export function TransporteModuleTabs({ tripId }: Props) {
    const base = `/viagens/${tripId}/transporte`;
    return (
        <div className="transporte-module-tabs" role="tablist" aria-label="Áreas de transporte">
            {TABS.map((tab) => (
                <NavLink
                    key={tab.id}
                    to={`${base}/${tab.segment}`}
                    end
                    className={({ isActive }) =>
                        `transporte-module-tab transporte-module-tab--${tab.tone}${isActive ? ' is-on' : ''}`
                    }
                    role="tab"
                    id={`transporte-tab-${tab.id}`}
                >
                    <span className="transporte-module-tab__icon" aria-hidden>
                        <MaterialIcon name={tab.icon} variant="app" filled opticalSize={22} />
                    </span>
                    <span className="transporte-module-tab__label">{tab.label}</span>
                </NavLink>
            ))}
        </div>
    );
}
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

export type MilhasHubPanel = 'operar' | 'extrato' | 'ferramentas';

const TABS: Array<{
    id: MilhasHubPanel;
    label: string;
    icon: string;
    tone: 'turquesa' | 'ouro' | 'oceano';
}> = [
    { id: 'operar', label: 'Operar', icon: 'edit_note', tone: 'turquesa' },
    { id: 'extrato', label: 'Extrato', icon: 'receipt_long', tone: 'ouro' },
    { id: 'ferramentas', label: 'Ferramentas', icon: 'calculate', tone: 'oceano' }
];

type Props = {
    value: MilhasHubPanel;
    onChange: (id: MilhasHubPanel) => void;
};

export function MilhasHubTabs({ value, onChange }: Props) {
    return (
        <div className="milhas-hub-tabs" role="tablist" aria-label="Áreas da central">
            {TABS.map((tab) => {
                const on = value === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        id={`milhas-tab-${tab.id}`}
                        aria-controls={`milhas-panel-${tab.id}`}
                        className={`milhas-hub-tab milhas-hub-tab--${tab.tone}${on ? ' is-on' : ''}`}
                        onClick={() => onChange(tab.id)}
                    >
                        <span className="milhas-hub-tab__icon" aria-hidden>
                            <MaterialIcon name={tab.icon} variant="app" filled={on} opticalSize={22} />
                        </span>
                        <span className="milhas-hub-tab__label">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
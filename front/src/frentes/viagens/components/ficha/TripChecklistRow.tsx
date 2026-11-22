import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripCheckItem } from '../../types';
import { ChecklistDueField } from '../ChecklistDueField';
import { isCheckDone } from '../../domain/tripChecklistUtils';

type Props = {
    item: TripCheckItem;
    due?: string;
    onPatch: (id: string, patch: Partial<TripCheckItem>) => void;
    onRemove: () => void;
};

export function TripChecklistRow({ item, due, onPatch, onRemove }: Props) {
    const done = isCheckDone(item);

    return (
        <div className={`viagens-checklist-item${done ? ' is-done' : ''}`} data-check-id={item.id}>
            <button
                type="button"
                className="viagens-checklist-item__toggle"
                aria-pressed={done}
                aria-label={done ? 'Feito' : 'A fazer'}
                onClick={() => onPatch(item.id, { done: !done, completed: !done })}
            >
                <MaterialIcon
                    name={done ? 'check_circle' : 'radio_button_unchecked'}
                    filled={done}
                    variant="app"
                    opticalSize={20}
                />
            </button>
            <input
                className="viagens-checklist-item__title"
                value={item.title}
                placeholder="Item"
                onChange={(e) => onPatch(item.id, { title: e.target.value })}
            />
            <div className="viagens-checklist-item__actions">
                <div className={`viagens-checklist-item__due${due ? ' has-date' : ''}`}>
                    <ChecklistDueField
                        value={due}
                        onChange={(next) =>
                            onPatch(item.id, {
                                dueOn: next,
                                due_on: next
                            })
                        }
                    />
                </div>
                <button type="button" className="viagens-checklist-item__remove" aria-label="Remover item" onClick={onRemove}>
                    <MaterialIcon name="close" filled={false} variant="app" opticalSize={14} />
                </button>
            </div>
        </div>
    );
}
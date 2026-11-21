import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TripCheckItem } from '../types';
import { isCheckDone } from '../domain/tripChecklistUtils';

type Props = {
    items: TripCheckItem[];
    editing: boolean;
    onToggle: (id: string, done: boolean) => void;
    onTitle: (id: string, title: string) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
};

export function TripIdCountryChecklist({ items, editing, onToggle, onTitle, onRemove, onAdd }: Props) {
    if (!items.length && !editing) {
        return <p className="trip-id-check__empty">Nenhum item</p>;
    }

    return (
        <ul className="trip-id-checklist" aria-label="Itens">
            {items.map((item) => {
                const done = isCheckDone(item);
                return (
                    <li key={item.id} className={`trip-id-checklist__item${done ? ' is-done' : ''}`}>
                        <button
                            type="button"
                            className="trip-id-checklist__toggle"
                            aria-pressed={done}
                            aria-label={done ? 'Marcar pendente' : 'Marcar feito'}
                            onClick={() => onToggle(item.id, !done)}
                        >
                            <MaterialIcon
                                name={done ? 'check_box' : 'check_box_outline_blank'}
                                variant="app"
                                opticalSize={18}
                                filled={done}
                            />
                        </button>
                        {editing ? (
                            <input
                                className="trip-id-checklist__title"
                                value={item.title}
                                placeholder="Item"
                                onChange={(e) => onTitle(item.id, e.target.value)}
                            />
                        ) : (
                            <span className="trip-id-checklist__title">{item.title || '—'}</span>
                        )}
                        <button
                            type="button"
                            className={`trip-id-checklist__remove${editing ? '' : ' trip-id-checklist__remove--ghost'}`}
                            aria-label="Remover"
                            onClick={() => onRemove(item.id)}
                        >
                            <MaterialIcon name="close" variant="app" opticalSize={14} />
                        </button>
                    </li>
                );
            })}
            {editing ? (
                <li className="trip-id-checklist__add-row">
                    <button type="button" className="trip-id-checklist__add" onClick={onAdd}>
                        <MaterialIcon name="add" variant="app" opticalSize={15} />
                        Adicionar
                    </button>
                </li>
            ) : null}
        </ul>
    );
}
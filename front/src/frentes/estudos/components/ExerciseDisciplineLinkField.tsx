import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { StudyDiscipline } from '../types';

export type LinkFieldValue = {
    linkToAll: boolean;
    linkedDisciplineIds: string[];
};

type Props = {
    idPrefix: string;
    disciplines: StudyDiscipline[];
    value: LinkFieldValue;
    onChange: (next: LinkFieldValue) => void;
    compact?: boolean;
};

export function linkSummary(value: LinkFieldValue, disciplines: StudyDiscipline[]): string {
    if (disciplines.length === 0) return 'Só na lista de exercícios';
    if (value.linkToAll) return `Todas (${disciplines.length})`;
    const n = value.linkedDisciplineIds.length;
    if (n === 0) return 'Nenhuma disciplina — não aparece nas fichas';
    if (n === 1) {
        const id = value.linkedDisciplineIds[0];
        const title = disciplines.find((d) => d.id === id)?.title;
        return title ? `Só em ${title}` : '1 disciplina';
    }
    return `${n} disciplinas selecionadas`;
}

export function ExerciseDisciplineLinkField({ idPrefix, disciplines, value, onChange, compact }: Props) {
    const [query, setQuery] = useState('');
    const mode: 'all' | 'pick' = value.linkToAll ? 'all' : 'pick';

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return disciplines;
        return disciplines.filter((d) => d.title.toLowerCase().includes(q));
    }, [disciplines, query]);

    const selected = useMemo(() => new Set(value.linkedDisciplineIds), [value.linkedDisciplineIds]);

    const setAll = () => {
        onChange({ linkToAll: true, linkedDisciplineIds: [] });
    };

    const setPick = () => {
        onChange({
            linkToAll: false,
            linkedDisciplineIds: value.linkToAll ? [] : [...value.linkedDisciplineIds]
        });
    };

    const toggleDiscipline = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange({ linkToAll: false, linkedDisciplineIds: [...next] });
    };

    const selectAllVisible = () => {
        const next = new Set(selected);
        for (const d of filtered) next.add(d.id);
        onChange({ linkToAll: false, linkedDisciplineIds: [...next] });
    };

    const clearSelection = () => {
        onChange({ linkToAll: false, linkedDisciplineIds: [] });
    };

    return (
        <div className={`estudos-link-field${compact ? ' estudos-link-field--compact' : ''}`}>
            <div className="estudos-link-field__summary" role="status">
                <MaterialIcon name="hub" variant="app" />
                <span>{linkSummary(value, disciplines)}</span>
            </div>

            <div className="estudos-link-segment" role="tablist" aria-label="Modo de vínculo">
                <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'all'}
                    className={`estudos-link-segment__btn${mode === 'all' ? ' estudos-link-segment__btn--active' : ''}`}
                    onClick={setAll}
                    disabled={disciplines.length === 0}
                >
                    <MaterialIcon name="select_all" variant="app" />
                    Todas
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'pick'}
                    className={`estudos-link-segment__btn${mode === 'pick' ? ' estudos-link-segment__btn--active' : ''}`}
                    onClick={setPick}
                    disabled={disciplines.length === 0}
                >
                    <MaterialIcon name="checklist" variant="app" />
                    Escolher
                </button>
            </div>

            {disciplines.length === 0 ? (
                <p className="estudos-modal__hint">
                    Nenhuma disciplina no curso. O exercício fica só na aba Exercícios até você criar disciplinas.
                </p>
            ) : mode === 'all' ? (
                <p className="estudos-link-field__note">
                    O exercício aparece como atalho em <strong>todas</strong> as disciplinas atuais e nas que você criar
                    depois.
                </p>
            ) : (
                <>
                    <div className="estudos-link-field__toolbar">
                        <div className="estudos-link-field__search">
                            <MaterialIcon name="search" variant="app" />
                            <input
                                id={`${idPrefix}-link-search`}
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar disciplina…"
                                autoComplete="off"
                            />
                        </div>
                        <div className="estudos-link-field__quick">
                            <button type="button" className="estudos-link-quick-btn" onClick={selectAllVisible}>
                                Marcar visíveis
                            </button>
                            <button type="button" className="estudos-link-quick-btn" onClick={clearSelection}>
                                Limpar
                            </button>
                        </div>
                    </div>

                    <ul className="estudos-link-cards">
                        {filtered.length === 0 ? (
                            <li className="estudos-link-cards__empty">Nenhum resultado para &quot;{query}&quot;</li>
                        ) : (
                            filtered.map((d) => {
                                const checked = selected.has(d.id);
                                return (
                                    <li key={d.id}>
                                        <button
                                            type="button"
                                            className={`estudos-link-card${checked ? ' estudos-link-card--on' : ''}`}
                                            onClick={() => toggleDiscipline(d.id)}
                                            aria-pressed={checked}
                                        >
                                            <span className="estudos-link-card__check" aria-hidden="true">
                                                <MaterialIcon
                                                    name={checked ? 'check_circle' : 'radio_button_unchecked'}
                                                    variant="app"
                                                />
                                            </span>
                                            <span className="estudos-link-card__body">
                                                <span className="estudos-link-card__title">{d.title}</span>
                                                {d.summary ? (
                                                    <span className="estudos-link-card__meta">{d.summary}</span>
                                                ) : null}
                                                <span className="estudos-link-card__progress">
                                                    <span
                                                        className="estudos-link-card__progress-fill"
                                                        style={{ width: `${d.progress}%` }}
                                                    />
                                                    <span className="estudos-link-card__progress-label">{d.progress}%</span>
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </>
            )}
        </div>
    );
}
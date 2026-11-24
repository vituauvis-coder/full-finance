import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { ExerciseType } from '../domain/exerciseDoc';
import { exerciseTypeLabel } from '../domain/exerciseDoc';
import type { StudyDiscipline } from '../types';
import { ExerciseDisciplineLinkField, type LinkFieldValue } from './ExerciseDisciplineLinkField';

type Props = {
    open: boolean;
    disciplines: StudyDiscipline[];
    onClose: () => void;
    onCreate: (input: {
        title: string;
        type: ExerciseType;
        linkToAll: boolean;
        linkedDisciplineIds: string[];
    }) => void;
};

const TYPES: { type: ExerciseType; icon: string; desc: string }[] = [
    {
        type: 'quiz',
        icon: 'quiz',
        desc: 'Perguntas com alternativas e gabarito.'
    },
    {
        type: 'flashcards',
        icon: 'style',
        desc: 'Frente e verso para memorização.'
    }
];

export function NovoExercicioModal({ open, disciplines, onClose, onCreate }: Props) {
    const titleId = useId();
    const linkFieldId = useId();
    const [title, setTitle] = useState('');
    const [type, setType] = useState<ExerciseType>('quiz');
    const [links, setLinks] = useState<LinkFieldValue>({ linkToAll: true, linkedDisciplineIds: [] });

    useEffect(() => {
        if (!open) return;
        setTitle('');
        setType('quiz');
        setLinks({
            linkToAll: disciplines.length > 0,
            linkedDisciplineIds: []
        });
    }, [open, disciplines.length]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    if (typeof document === 'undefined') return null;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        onCreate({
            title: trimmed,
            type,
            linkToAll: links.linkToAll,
            linkedDisciplineIds: links.linkToAll ? [] : [...links.linkedDisciplineIds]
        });
    };

    return createPortal(
        <div className="estudos-modal-root" role="presentation" onClick={onClose}>
            <div
                className="estudos-modal estudos-modal--exercicio"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="estudos-modal__head">
                    <div>
                        <p className="estudos-modal__eyebrow">Novo exercício</p>
                        <h2 id={titleId}>Escolha o formato</h2>
                    </div>
                    <button type="button" className="estudos-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" />
                    </button>
                </header>

                <form className="estudos-modal__body" onSubmit={submit}>
                    <label className="estudos-field">
                        <span className="estudos-field__label">Nome</span>
                        <input
                            className="estudos-field__input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex.: Revisão semana 3"
                            autoFocus
                            required
                        />
                    </label>

                    <fieldset className="estudos-exercise-types">
                        <legend className="estudos-field__label">Tipo</legend>
                        <div className="estudos-exercise-types__grid">
                            {TYPES.map((item) => (
                                <label
                                    key={item.type}
                                    className={`estudos-exercise-type${type === item.type ? ' estudos-exercise-type--active' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="exercise-type"
                                        value={item.type}
                                        checked={type === item.type}
                                        onChange={() => setType(item.type)}
                                    />
                                    <MaterialIcon name={item.icon} variant="app" />
                                    <span className="estudos-exercise-type__name">{exerciseTypeLabel(item.type)}</span>
                                    <span className="estudos-exercise-type__desc">{item.desc}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="estudos-exercise-links-field">
                        <legend className="estudos-field__label">Vínculo com disciplinas</legend>
                        <ExerciseDisciplineLinkField
                            idPrefix={linkFieldId}
                            disciplines={disciplines}
                            value={links}
                            onChange={setLinks}
                            compact
                        />
                    </fieldset>

                    <footer className="estudos-modal__foot">
                        <button type="button" className="estudos-btn-ghost" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="estudos-btn-primary">
                            <MaterialIcon name="arrow_forward" variant="app" />
                            Criar e configurar
                        </button>
                    </footer>
                </form>
            </div>
        </div>,
        document.body
    );
}
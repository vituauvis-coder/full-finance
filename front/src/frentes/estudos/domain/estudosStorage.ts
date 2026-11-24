import { emptyExerciseDoc, exerciseTypeLabel, serializeExerciseDoc, type ExerciseType } from './exerciseDoc';
import { exerciseAppliesToDiscipline, exercisesForDiscipline } from './exerciseLinks';
import type { EstudosStore, StudyDiscipline, StudyExercise, StudyProgram } from '../types';

const STORAGE_KEY = 'meu-mundo:estudos:v1';

function nowIso() {
    return new Date().toISOString();
}

function uid(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function legacyItemToExercise(leg: StudyDiscipline): StudyExercise {
    return {
        id: leg.id,
        studyId: leg.studyId,
        title: leg.title,
        summary: leg.summary,
        notesHtml: leg.notesHtml,
        notesUpdatedAt: leg.notesUpdatedAt,
        progress: leg.progress,
        order: leg.order,
        linkToAll: true,
        linkedDisciplineIds: []
    };
}

export function normalizeEstudosStore(raw: EstudosStore): EstudosStore {
    let exercises = raw.exercises ?? [];
    let disciplines = raw.disciplines.filter((d) => d.kind !== 'exercicio');
    let studies = raw.studies.map((s) => ({
        ...s,
        exerciseIds: s.exerciseIds ?? []
    }));

    const legacyExercises = raw.disciplines.filter((d) => d.kind === 'exercicio');
    if (legacyExercises.length > 0) {
        const migratedIds = new Set(exercises.map((e) => e.id));
        for (const leg of legacyExercises) {
            if (migratedIds.has(leg.id)) continue;
            const ex = legacyItemToExercise(leg);
            exercises = [...exercises, ex];
            studies = studies.map((s) => {
                if (s.id !== leg.studyId) return s;
                return {
                    ...s,
                    disciplineIds: s.disciplineIds.filter((id) => id !== leg.id),
                    exerciseIds: s.exerciseIds.includes(leg.id) ? s.exerciseIds : [...s.exerciseIds, leg.id]
                };
            });
        }
    }

    for (const study of studies) {
        const discSet = new Set(disciplines.filter((d) => d.studyId === study.id).map((d) => d.id));
        study.disciplineIds = study.disciplineIds.filter((id) => discSet.has(id));
        const exSet = new Set(exercises.filter((e) => e.studyId === study.id).map((e) => e.id));
        study.exerciseIds = study.exerciseIds.filter((id) => exSet.has(id));
    }

    return { version: 1, studies, disciplines, exercises };
}

export function seedEstudosStore(): EstudosStore {
    const analyticsId = 'study_analytics';
    const psicologiaId = 'study_psicologia';

    const discModelagem: StudyDiscipline = {
        id: 'disc_modelagem',
        studyId: analyticsId,
        title: 'Modelagem preditiva',
        progress: 65,
        summary: 'Regressão, classificação e métricas de avaliação.',
        resources: [
            {
                id: 'r1',
                title: 'Aula 01 — Introdução',
                url: 'https://example.com/aula-intro',
                kind: 'video'
            },
            {
                id: 'r2',
                title: 'Slides — Semana 3',
                url: '#',
                kind: 'arquivo'
            }
        ],
        notesHtml:
            '<h2>Resumo da aula</h2><p>Variáveis independentes, overfitting e validação cruzada.</p><ul><li>Train / test split</li><li>Regularização</li></ul>',
        notesUpdatedAt: nowIso(),
        order: 0
    };

    const discEstatistica: StudyDiscipline = {
        id: 'disc_estatistica',
        studyId: analyticsId,
        title: 'Estatística aplicada',
        progress: 0,
        summary: 'Distribuições, inferência e testes de hipótese.',
        resources: [],
        notesHtml: '<p>Começar pelos capítulos 1 e 2 do material.</p>',
        order: 1
    };

    const exRevisao: StudyExercise = {
        id: 'ex_revisao_analytics',
        studyId: analyticsId,
        title: 'Revisão — métricas',
        summary: 'Flashcards',
        notesHtml: serializeExerciseDoc(emptyExerciseDoc('flashcards')),
        progress: 0,
        order: 0,
        linkToAll: false,
        linkedDisciplineIds: [discModelagem.id]
    };

    const exTcc: StudyExercise = {
        id: 'disc_tcc',
        studyId: psicologiaId,
        title: 'TCC — Cognição social',
        summary: 'Monografia entregue e aprovada.',
        notesHtml: '<p><strong>Referências principais</strong></p><p>Anotações de banca e feedbacks.</p>',
        notesUpdatedAt: '2024-01-10T12:00:00.000Z',
        progress: 100,
        order: 0,
        linkToAll: true,
        linkedDisciplineIds: []
    };

    const studies: StudyProgram[] = [
        {
            id: analyticsId,
            title: 'Analytics',
            level: 'pos',
            status: 'fazendo',
            institution: 'PUC - Minas',
            targetDate: '2027-01-07',
            icon: 'account_balance',
            disciplineIds: [discModelagem.id, discEstatistica.id],
            exerciseIds: [exRevisao.id],
            createdAt: nowIso(),
            updatedAt: nowIso()
        },
        {
            id: psicologiaId,
            title: 'Psicologia',
            level: 'graduacao',
            status: 'concluido',
            institution: 'Estácio Recife',
            targetDate: '2024-01-01',
            icon: 'school',
            disciplineIds: [],
            exerciseIds: [exTcc.id],
            createdAt: nowIso(),
            updatedAt: nowIso()
        }
    ];

    return normalizeEstudosStore({
        version: 1,
        studies,
        disciplines: [discModelagem, discEstatistica],
        exercises: [exRevisao, exTcc]
    });
}

export function readEstudosStore(): EstudosStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const seeded = seedEstudosStore();
            writeEstudosStore(seeded);
            return seeded;
        }
        const parsed = JSON.parse(raw) as EstudosStore;
        if (parsed?.version !== 1 || !Array.isArray(parsed.studies) || !Array.isArray(parsed.disciplines)) {
            const seeded = seedEstudosStore();
            writeEstudosStore(seeded);
            return seeded;
        }
        const normalized = normalizeEstudosStore({
            version: 1,
            studies: parsed.studies,
            disciplines: parsed.disciplines,
            exercises: parsed.exercises ?? []
        });
        const hadLegacy = parsed.disciplines.some((d) => d.kind === 'exercicio');
        const missingExercises = !parsed.exercises?.length && normalized.exercises.length > 0;
        if (hadLegacy || missingExercises || parsed.studies.some((s) => !s.exerciseIds)) {
            writeEstudosStore(normalized);
        }
        return normalized;
    } catch {
        const seeded = seedEstudosStore();
        writeEstudosStore(seeded);
        return seeded;
    }
}

export function writeEstudosStore(store: EstudosStore): void {
    try {
        const normalized = normalizeEstudosStore(store);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        window.dispatchEvent(new CustomEvent('meumundo-estudos-change'));
    } catch {
        /* storage indisponível */
    }
}

export function upsertStudy(program: StudyProgram, disciplines: StudyDiscipline[]): void {
    const store = readEstudosStore();
    const studies = store.studies.filter((s) => s.id !== program.id);
    const disciplineIds = new Set(program.disciplineIds);
    const otherDisciplines = store.disciplines.filter((d) => !disciplineIds.has(d.id) || d.studyId !== program.id);
    const incoming = disciplines.filter((d) => disciplineIds.has(d.id));
    writeEstudosStore({
        version: 1,
        studies: [...studies, program],
        disciplines: [...otherDisciplines, ...incoming],
        exercises: store.exercises
    });
}

export function updateDisciplineNotes(disciplineId: string, notesHtml: string): StudyDiscipline | null {
    const store = readEstudosStore();
    const idx = store.disciplines.findIndex((d) => d.id === disciplineId);
    if (idx < 0) return null;
    const next: StudyDiscipline = {
        ...store.disciplines[idx],
        notesHtml,
        notesUpdatedAt: nowIso()
    };
    const disciplines = [...store.disciplines];
    disciplines[idx] = next;
    writeEstudosStore({ ...store, disciplines });
    return next;
}

export function updateExerciseNotes(exerciseId: string, notesHtml: string): StudyExercise | null {
    const store = readEstudosStore();
    const idx = store.exercises.findIndex((e) => e.id === exerciseId);
    if (idx < 0) return null;
    const next: StudyExercise = {
        ...store.exercises[idx],
        notesHtml,
        notesUpdatedAt: nowIso()
    };
    const exercises = [...store.exercises];
    exercises[idx] = next;
    writeEstudosStore({ ...store, exercises });
    return next;
}

export function updateDisciplineProgress(disciplineId: string, progress: number): StudyDiscipline | null {
    const store = readEstudosStore();
    const idx = store.disciplines.findIndex((d) => d.id === disciplineId);
    if (idx < 0) return null;
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    const next: StudyDiscipline = { ...store.disciplines[idx], progress: clamped };
    const disciplines = [...store.disciplines];
    disciplines[idx] = next;
    writeEstudosStore({ ...store, disciplines });
    return next;
}

export function createStudyDraft(title: string): { study: StudyProgram; disciplines: StudyDiscipline[] } {
    const id = uid('study');
    const study: StudyProgram = {
        id,
        title: title.trim() || 'Novo curso',
        level: 'curso',
        status: 'planejado',
        institution: '',
        icon: 'menu_book',
        disciplineIds: [],
        exerciseIds: [],
        createdAt: nowIso(),
        updatedAt: nowIso()
    };
    return { study, disciplines: [] };
}

export function appendDiscipline(
    studyId: string,
    partial: Pick<StudyDiscipline, 'title'> & Partial<Pick<StudyDiscipline, 'summary' | 'notesHtml'>>
): StudyDiscipline | null {
    const store = readEstudosStore();
    const study = store.studies.find((s) => s.id === studyId);
    if (!study) return null;
    const discipline: StudyDiscipline = {
        id: uid('disc'),
        studyId,
        title: partial.title.trim() || 'Nova disciplina',
        progress: 0,
        summary: partial.summary,
        resources: [],
        notesHtml: partial.notesHtml ?? '<p></p>',
        order: study.disciplineIds.length
    };
    const studies = store.studies.map((s) =>
        s.id === studyId
            ? {
                  ...s,
                  disciplineIds: [...s.disciplineIds, discipline.id],
                  updatedAt: nowIso()
              }
            : s
    );
    writeEstudosStore({
        version: 1,
        studies,
        disciplines: [...store.disciplines, discipline],
        exercises: store.exercises
    });
    return discipline;
}

export type NewExerciseInput = {
    title: string;
    type: ExerciseType;
    linkToAll: boolean;
    linkedDisciplineIds: string[];
};

export function appendExercise(studyId: string, input: NewExerciseInput): StudyExercise | null {
    const store = readEstudosStore();
    const study = store.studies.find((s) => s.id === studyId);
    if (!study) return null;
    const doc = emptyExerciseDoc(input.type);
    const exercise: StudyExercise = {
        id: uid('ex'),
        studyId,
        title: input.title.trim() || 'Novo exercício',
        summary: exerciseTypeLabel(input.type),
        notesHtml: serializeExerciseDoc(doc),
        progress: 0,
        order: study.exerciseIds.length,
        linkToAll: input.linkToAll,
        linkedDisciplineIds: input.linkToAll ? [] : [...input.linkedDisciplineIds]
    };
    const studies = store.studies.map((s) =>
        s.id === studyId
            ? {
                  ...s,
                  exerciseIds: [...s.exerciseIds, exercise.id],
                  updatedAt: nowIso()
              }
            : s
    );
    writeEstudosStore({
        version: 1,
        studies,
        disciplines: store.disciplines,
        exercises: [...store.exercises, exercise]
    });
    return exercise;
}

export function updateExerciseLinks(
    exerciseId: string,
    links: Pick<StudyExercise, 'linkToAll' | 'linkedDisciplineIds'>
): StudyExercise | null {
    const store = readEstudosStore();
    const idx = store.exercises.findIndex((e) => e.id === exerciseId);
    if (idx < 0) return null;
    const linked = links.linkToAll ? [] : [...links.linkedDisciplineIds];
    const next: StudyExercise = {
        ...store.exercises[idx],
        linkToAll: links.linkToAll,
        linkedDisciplineIds: linked
    };
    const exercises = [...store.exercises];
    exercises[idx] = next;
    writeEstudosStore({ ...store, exercises });
    return next;
}

export function studyProgress(study: StudyProgram, disciplines: StudyDiscipline[]): number {
    const mine = disciplines.filter((d) => study.disciplineIds.includes(d.id));
    if (study.progress != null && mine.length === 0) return study.progress;
    if (mine.length === 0) return 0;
    const sum = mine.reduce((acc, d) => acc + d.progress, 0);
    return Math.round(sum / mine.length);
}

export function disciplinesForStudy(store: EstudosStore, studyId: string): StudyDiscipline[] {
    const study = store.studies.find((s) => s.id === studyId);
    if (!study) return [];
    const map = new Map(store.disciplines.map((d) => [d.id, d] as const));
    return study.disciplineIds
        .map((id) => map.get(id))
        .filter((d): d is StudyDiscipline => Boolean(d))
        .sort((a, b) => a.order - b.order);
}

export function exercisesForStudy(store: EstudosStore, studyId: string): StudyExercise[] {
    const study = store.studies.find((s) => s.id === studyId);
    if (!study) return [];
    const map = new Map(store.exercises.map((e) => [e.id, e] as const));
    return study.exerciseIds
        .map((id) => map.get(id))
        .filter((e): e is StudyExercise => Boolean(e))
        .sort((a, b) => a.order - b.order);
}

export function linkedExercisesForDiscipline(
    store: EstudosStore,
    studyId: string,
    disciplineId: string
): StudyExercise[] {
    return exercisesForDiscipline(exercisesForStudy(store, studyId), disciplineId);
}

export { exerciseAppliesToDiscipline, exercisesForDiscipline };

export function completedDisciplineCount(study: StudyProgram, disciplines: StudyDiscipline[]): number {
    const mine = disciplines.filter((d) => study.disciplineIds.includes(d.id));
    return mine.filter((d) => d.progress >= 100).length;
}

export function findExercise(store: EstudosStore, exerciseId: string): StudyExercise | undefined {
    return store.exercises.find((e) => e.id === exerciseId);
}
export type StudyLevel = 'graduacao' | 'pos' | 'curso' | 'outro';

export type StudyStatus = 'fazendo' | 'pausado' | 'concluido' | 'planejado';

/** @deprecated itens legados no storage; disciplinas atuais não usam kind */
export type DisciplineKind = 'disciplina' | 'exercicio';

export type StudyResourceLink = {
    id: string;
    title: string;
    url: string;
    kind: 'video' | 'arquivo' | 'link';
};

export type StudyDiscipline = {
    id: string;
    studyId: string;
    title: string;
    kind?: DisciplineKind;
    progress: number;
    summary?: string;
    resources: StudyResourceLink[];
    notesHtml: string;
    notesUpdatedAt?: string;
    order: number;
};

export type StudyExercise = {
    id: string;
    studyId: string;
    title: string;
    summary?: string;
    notesHtml: string;
    notesUpdatedAt?: string;
    progress: number;
    order: number;
    /** Quando true, aparece em todas as disciplinas do curso */
    linkToAll: boolean;
    linkedDisciplineIds: string[];
};

export type StudyProgram = {
    id: string;
    title: string;
    level: StudyLevel;
    status: StudyStatus;
    institution: string;
    targetDate?: string;
    icon: string;
    progress?: number;
    disciplineIds: string[];
    exerciseIds: string[];
    createdAt: string;
    updatedAt: string;
};

export type EstudosStore = {
    version: 1;
    studies: StudyProgram[];
    disciplines: StudyDiscipline[];
    exercises: StudyExercise[];
};
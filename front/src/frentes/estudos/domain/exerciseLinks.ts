import type { StudyDiscipline, StudyExercise } from '../types';

export function exerciseAppliesToDiscipline(exercise: StudyExercise, disciplineId: string): boolean {
    if (exercise.linkToAll) return true;
    return exercise.linkedDisciplineIds.includes(disciplineId);
}

export function exercisesForDiscipline(exercises: StudyExercise[], disciplineId: string): StudyExercise[] {
    return exercises.filter((ex) => exerciseAppliesToDiscipline(ex, disciplineId));
}

export function linkLabels(
    exercise: StudyExercise,
    disciplines: StudyDiscipline[]
): { id: string; label: string }[] {
    if (exercise.linkToAll) {
        return [{ id: '__all__', label: 'Todas as disciplinas' }];
    }
    if (exercise.linkedDisciplineIds.length === 0) {
        return [{ id: '__none__', label: 'Sem vínculo' }];
    }
    const map = new Map(disciplines.map((d) => [d.id, d.title] as const));
    return exercise.linkedDisciplineIds.map((id) => ({
        id,
        label: map.get(id) ?? 'Disciplina'
    }));
}
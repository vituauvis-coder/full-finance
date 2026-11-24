import type { StudyLevel, StudyStatus } from '../types';

export function studyLevelLabel(level: StudyLevel): string {
    switch (level) {
        case 'graduacao':
            return 'Graduação';
        case 'pos':
            return 'Pós-graduação';
        case 'curso':
            return 'Curso';
        default:
            return 'Outro';
    }
}

export function studyStatusLabel(status: StudyStatus): string {
    switch (status) {
        case 'fazendo':
            return 'Fazendo';
        case 'pausado':
            return 'Pausado';
        case 'concluido':
            return 'Concluído';
        case 'planejado':
            return 'Planejado';
        default:
            return status;
    }
}

export function formatStudyDate(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}
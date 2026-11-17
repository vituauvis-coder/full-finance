export function formatTripDateRange(startsOn, endsOn) {
    const fmt = (key) => {
        const d = new Date(`${key}T12:00:00`);
        return d
            .toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'America/Sao_Paulo'
            })
            .replace(/\./g, '');
    };
    if (startsOn && endsOn) return `${fmt(startsOn)} – ${fmt(endsOn)}`;
    if (startsOn) return fmt(startsOn);
    if (endsOn) return fmt(endsOn);
    return 'Sem datas';
}
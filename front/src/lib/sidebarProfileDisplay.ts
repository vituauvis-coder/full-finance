export type SidebarProfileView = {
    title: string;
    subtitle: string | null;
    initial: string;
};

export function sidebarProfileFromEmail(email: string): SidebarProfileView {
    const raw = email.trim();
    if (!raw) {
        return { title: 'Minha conta', subtitle: null, initial: '?' };
    }
    if (!raw.includes('@')) {
        return { title: raw, subtitle: null, initial: raw[0]!.toUpperCase() };
    }
    const [local, domain] = raw.split('@');
    const title = humanizeEmailLocal(local || 'conta');
    return {
        title,
        subtitle: `${local}@${domain}`,
        initial: (local[0] || '?').toUpperCase()
    };
}

function humanizeEmailLocal(local: string) {
    const chunk = local.split(/[._-]+/).filter(Boolean)[0] || local;
    if (!chunk) return 'Conta';
    return chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase();
}
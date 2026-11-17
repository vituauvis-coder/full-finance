/** Decoração de fundo (mesh + grade + orbs), par com auth-modern. */
export function AppAmbientBackground() {
    return (
        <div className="app-ambient-bg" aria-hidden="true">
            <div className="app-ambient-bg__mesh" />
            <div className="app-ambient-bg__grid" />
            <div className="app-ambient-bg__orbs">
                <span className="app-ambient-bg__orb app-ambient-bg__orb--1" />
                <span className="app-ambient-bg__orb app-ambient-bg__orb--2" />
                <span className="app-ambient-bg__orb app-ambient-bg__orb--3" />
            </div>
        </div>
    );
}
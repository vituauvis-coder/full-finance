export const ROLE_USER = 'USER';
export const ROLE_ADMIN = 'ADMIN';

export function userIsAdmin(u) {
    if (!u) return false;
    return String(u.role || ROLE_USER).toUpperCase() === ROLE_ADMIN;
}

export function publicAuthUser(u) {
    if (!u) return null;
    const role = String(u.role || ROLE_USER).toUpperCase() === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER;
    return {
        uid: u.id,
        email: u.email,
        emailVerified: true,
        role,
        isAdmin: role === ROLE_ADMIN
    };
}
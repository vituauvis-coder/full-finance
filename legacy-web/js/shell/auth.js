// js/auth.js — autenticação local (API + sessão)
import { reportAppError } from '../app/error-handling.js';

let onUserLoggedIn = () => {};
let onUserLoggedOut = () => {};

/**
 * Configura o estado de autenticação (sessão no servidor).
 */
export function initAuth(onLoggedIn, onLoggedOut) {
    onUserLoggedIn = onLoggedIn;
    onUserLoggedOut = onLoggedOut;
    fetch('/api/auth/me', { credentials: 'include' })
        .then((r) => r.json())
        .then(({ user }) => {
            if (user) {
                return Promise.resolve(onUserLoggedIn(user)).catch((err) =>
                    reportAppError(err, 'Ao restaurar sessão')
                );
            }
            onUserLoggedOut();
        })
        .catch(() => onUserLoggedOut());
}

/**
 * Lida com o processo de login.
 */
export async function handleLogin(email, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err.error || 'Falha no login');
        e.code = err.code || 'auth/wrong-password';
        throw e;
    }
    const { user } = await res.json();
    await Promise.resolve(onUserLoggedIn(user)).catch((err) =>
        reportAppError(err, 'Após login')
    );
}

/**
 * Lida com o processo de registro.
 */
export async function handleRegister(name, email, password, confirmPassword) {
    if (password !== confirmPassword) {
        throw new Error('As senhas não coincidem.');
    }
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err.error || 'Falha no registro');
        e.code = err.code || 'auth/email-already-in-use';
        throw e;
    }
    const { user } = await res.json();
    await Promise.resolve(onUserLoggedIn(user)).catch((err) =>
        reportAppError(err, 'Após registro')
    );
}

/**
 * Encerra a sessão no servidor e atualiza a UI.
 */
export async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    onUserLoggedOut();
}

/**
 * Retorna uma mensagem de erro de autenticação amigável.
 */
export function getAuthErrorMessage(errorCode) {
    const messages = {
        'auth/email-already-in-use': 'Este email já está em uso.',
        'auth/invalid-email': 'O formato do email é inválido.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
        'auth/user-not-found': 'Email ou senha incorretos.',
        'auth/wrong-password': 'Email ou senha incorretos.'
    };
    return messages[errorCode] || 'Ocorreu um erro. Tente novamente.';
}

import { type FormEvent, useCallback, useState } from 'react';
import { useAuth } from '../../../app/AuthProvider';
import { apiFetch } from '../../../lib/http';

const MIN_PASSWORD_LEN = 6;

export function useRegisterForm() {
    const { refresh } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const submit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            setError(null);
            if (password.length < MIN_PASSWORD_LEN) {
                setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LEN} caracteres.`);
                return;
            }
            if (password !== confirmPassword) {
                setError('As senhas não coincidem.');
                return;
            }
            setSubmitting(true);
            try {
                await apiFetch('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name: name.trim(), email: email.trim(), password })
                });
                await refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Falha ao criar conta');
            } finally {
                setSubmitting(false);
            }
        },
        [name, email, password, confirmPassword, refresh]
    );

    return {
        name,
        setName,
        email,
        setEmail,
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
        error,
        submitting,
        submit
    };
}
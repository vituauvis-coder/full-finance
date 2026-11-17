import { type FormEvent, useCallback, useState } from 'react';
import { useAuth } from '../../../app/AuthProvider';
import { apiFetch } from '../../../lib/http';

export function useLoginForm() {
    const { refresh } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const submit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            setError(null);
            setSubmitting(true);
            try {
                await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: email.trim(), password })
                });
                await refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Falha ao entrar');
            } finally {
                setSubmitting(false);
            }
        },
        [email, password, refresh]
    );

    return {
        email,
        setEmail,
        password,
        setPassword,
        error,
        submitting,
        submit
    };
}
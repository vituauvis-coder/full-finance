import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
    createAgentToken,
    listAgentTokens,
    revokeAgentToken,
    type AgentTokenMeta
} from '../api/agentTokens';

export function ProfileAgentTokensCard() {
    const [tokens, setTokens] = useState<AgentTokenMeta[]>([]);
    const [name, setName] = useState('Meu assistente');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [plainToken, setPlainToken] = useState<string | null>(null);

    const reload = useCallback(async () => {
        try {
            const rows = await listAgentTokens();
            setTokens(rows);
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Erro ao carregar tokens');
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function onCreate(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        setPlainToken(null);
        try {
            const res = await createAgentToken(name.trim());
            setPlainToken(res.token);
            setMessage(res.warning);
            await reload();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Erro ao criar token');
        } finally {
            setBusy(false);
        }
    }

    async function onRevoke(id: string) {
        if (!window.confirm('Revogar este token? O agente deixará de funcionar.')) return;
        setBusy(true);
        setMessage(null);
        try {
            await revokeAgentToken(id);
            await reload();
            setMessage('Token revogado.');
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Erro ao revogar');
        } finally {
            setBusy(false);
        }
    }

    return (
        <article className="profile-card profile-modern__card">
            <header className="profile-card__header">
                <h2 className="profile-card__title">Tokens do agente</h2>
                <p className="profile-card__subtitle">
                    Para o assistente «Meu Mundo» (API com Bearer). O segredo só aparece na criação.
                </p>
            </header>
            <form className="ui-form" onSubmit={(e) => void onCreate(e)}>
                <label className="ui-form-field">
                    <span>Nome</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
                </label>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !name.trim()}>
                    Gerar token
                </button>
            </form>
            {plainToken ? (
                <p className="profile-modern__feedback">
                    <strong>Novo token (copie agora):</strong>
                    <code style={{ display: 'block', wordBreak: 'break-all', marginTop: 8 }}>{plainToken}</code>
                </p>
            ) : null}
            {message ? <p className="profile-modern__feedback">{message}</p> : null}
            <ul className="profile-agent-tokens-list">
                {tokens.map((t) => (
                    <li key={t.id}>
                        <span>
                            {t.name}{' '}
                            <small>
                                ({t.scopes.join(', ') || '—'})
                                {t.lastUsedAt ? ` · usado ${new Date(t.lastUsedAt).toLocaleString()}` : ''}
                            </small>
                        </span>
                        <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={() => void onRevoke(t.id)}>
                            Revogar
                        </button>
                    </li>
                ))}
            </ul>
        </article>
    );
}
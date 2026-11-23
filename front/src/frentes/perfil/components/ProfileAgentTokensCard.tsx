import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    createAgentToken,
    listAgentTokens,
    revokeAgentToken,
    type AgentTokenMeta
} from '../api/agentTokens';
import { ProfileCard } from './ProfileCard';

export function ProfileAgentTokensCard() {
    const [tokens, setTokens] = useState<AgentTokenMeta[]>([]);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [plainToken, setPlainToken] = useState<string | null>(null);

    const apiBase =
        typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://seu-mundo.com/api';

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
        const trimmed = name.trim();
        if (!trimmed) return;
        setBusy(true);
        setMessage(null);
        setPlainToken(null);
        try {
            const res = await createAgentToken(trimmed);
            setPlainToken(res.token);
            setMessage(res.warning);
            setName('');
            await reload();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Erro ao criar token');
        } finally {
            setBusy(false);
        }
    }

    async function onRevoke(id: string) {
        if (!window.confirm('Revogar este token? O bot deixará de acessar sua conta.')) return;
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
        <ProfileCard
            slot="full"
            title="Acesso para bots (Grok e outros)"
            subtitle="Cada login do Meu Mundo pode gerar seu próprio token — membros da casa cadastram o deles aqui."
            icon="smart_toy"
            iconAccent
            ariaLabel="Token de API para assistentes de IA"
        >
            <section className="profile-agent-tokens__help ui-inset-card" aria-labelledby="profile-agent-help-title">
                <h4 id="profile-agent-help-title" className="ui-inset-card__title">
                    <MaterialIcon name="info" variant="app" opticalSize={18} aria-hidden />
                    Para que serve
                </h4>
                <p className="profile-modern__prose">
                    O token autoriza um <strong>assistente de IA</strong> (por exemplo um <strong>Grok bot</strong> ou
                    automação) a <strong>ler contas e categorias</strong> e a <strong>lançar saídas e entradas</strong> na
                    <strong> sua conta</strong>, com as mesmas regras do app (conta válida, saldo, idempotência por
                    comprovante).
                </p>
                <ol className="profile-agent-tokens__steps">
                    <li>
                        Dê um <strong>apelido</strong> abaixo (só para você reconhecer o bot — ex.: «Grok finanças»).
                    </li>
                    <li>
                        Toque em <strong>Gerar token</strong> e copie o texto <code>mm_agent_…</code> (ele aparece{' '}
                        <strong>só uma vez</strong>).
                    </li>
                    <li>
                        No <strong>Grok bot</strong> (ou na automação), configure a API do Meu Mundo:
                        <ul className="profile-agent-tokens__bullets">
                            <li>
                                URL base: <code className="profile-agent-tokens__code">{apiBase}</code>
                            </li>
                            <li>
                                Cabeçalho em cada chamada:{' '}
                                <code className="profile-agent-tokens__code">Authorization: Bearer mm_agent_…</code>
                            </li>
                        </ul>
                    </li>
                    <li>
                        O bot usará rotas como listar contas, categorias e criar saídas/entradas. Você pode enviar o
                        campo <code>externalRef</code> (ex.: id da mensagem do WhatsApp) para não lançar o mesmo
                        comprovante duas vezes.
                    </li>
                </ol>
                <p className="profile-modern__field-hint profile-agent-tokens__disclaimer">
                    Não compartilhe o token em chat público. Se vazar, revogue aqui e gere outro.
                </p>
            </section>

            <form className="profile-modern__form profile-modern__form--stacked" onSubmit={(e) => void onCreate(e)}>
                <label className="profile-modern__field">
                    <span>Apelido deste acesso</span>
                    <input
                        className="profile-modern__input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                        placeholder="Ex.: Grok — lançamentos da Millena"
                        autoComplete="off"
                        maxLength={80}
                    />
                    <span className="profile-modern__field-hint">
                        Só um rótulo na sua lista de tokens. Não é e-mail, usuário nem senha do Meu Mundo.
                    </span>
                </label>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !name.trim()}>
                    Gerar token
                </button>
            </form>

            {plainToken ? (
                <div className="profile-modern__feedback profile-agent-tokens__new" role="status">
                    <strong>Token novo — copie e cole no Grok bot agora:</strong>
                    <code className="profile-agent-tokens__secret">{plainToken}</code>
                </div>
            ) : null}
            {message ? <p className="profile-modern__feedback">{message}</p> : null}

            {tokens.length > 0 ? (
                <ul className="profile-agent-tokens__list">
                    {tokens.map((t) => (
                        <li key={t.id} className="profile-agent-tokens__row">
                            <div>
                                <span className="profile-agent-tokens__row-name">{t.name}</span>
                                <span className="profile-modern__field-hint">
                                    {t.scopes.join(', ') || '—'}
                                    {t.lastUsedAt ? ` · último uso ${new Date(t.lastUsedAt).toLocaleString()}` : ''}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--ghost"
                                disabled={busy}
                                onClick={() => void onRevoke(t.id)}
                            >
                                Revogar
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="profile-modern__field-hint">Nenhum token ativo ainda.</p>
            )}
        </ProfileCard>
    );
}
import { AuthCard } from './components/AuthCard';
import { AuthCardShell } from './components/AuthCardShell';
import { AuthFormError } from './components/AuthFormError';
import { AuthFormLink, AuthFormToggle } from './components/AuthFormToggle';
import { AuthPageShell } from './components/AuthPageShell';
import { AuthPasswordField } from './components/AuthPasswordField';
import { AuthSubmitButton } from './components/AuthSubmitButton';
import { AuthTextField } from './components/AuthTextField';
import { useLoginForm } from './hooks/useLoginForm';

export function LoginPage() {
    const form = useLoginForm();

    return (
        <AuthPageShell ariaLabel="Apresentação e acesso">
            <AuthCardShell>
            <AuthCard
                title="Acesse sua conta"
                titleId="auth-heading"
                subtitle="Entre com email e senha ou crie uma conta gratuita em segundos."
            >
                <form id="login-form" className="auth-form" onSubmit={(e) => void form.submit(e)} noValidate>
                    <AuthTextField
                        id="login-email"
                        label="Email"
                        icon="mail"
                        type="email"
                        value={form.email}
                        onChange={form.setEmail}
                        placeholder="voce@email.com"
                        autoComplete="email"
                    />
                    <AuthPasswordField
                        id="login-password"
                        label="Senha"
                        value={form.password}
                        onChange={form.setPassword}
                    />
                    <AuthFormError message={form.error} />
                    <AuthSubmitButton label="Entrar" busyLabel="Entrando…" submitting={form.submitting} />
                    <AuthFormToggle>
                        Não tem conta? <AuthFormLink to="/register">Criar conta</AuthFormLink>
                    </AuthFormToggle>
                </form>
            </AuthCard>
            </AuthCardShell>
        </AuthPageShell>
    );
}
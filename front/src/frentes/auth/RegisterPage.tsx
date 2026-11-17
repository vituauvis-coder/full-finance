import { AuthCard } from './components/AuthCard';
import { AuthCardShell } from './components/AuthCardShell';
import { AuthFormError } from './components/AuthFormError';
import { AuthFormLink, AuthFormToggle } from './components/AuthFormToggle';
import { AuthPageShell } from './components/AuthPageShell';
import { AuthPasswordField } from './components/AuthPasswordField';
import { AuthSubmitButton } from './components/AuthSubmitButton';
import { AuthTextField } from './components/AuthTextField';
import { useRegisterForm } from './hooks/useRegisterForm';

export function RegisterPage() {
    const form = useRegisterForm();

    return (
        <AuthPageShell ariaLabel="Cadastro">
            <AuthCardShell>
            <AuthCard title="Criar conta grátis" subtitle="Leva menos de um minuto. Sem cartão de crédito.">
                <form id="register-form" className="auth-form" onSubmit={(e) => void form.submit(e)} noValidate>
                    <AuthTextField
                        id="register-name"
                        label="Nome completo"
                        icon="person"
                        value={form.name}
                        onChange={form.setName}
                        placeholder="Seu nome"
                        autoComplete="name"
                    />
                    <AuthTextField
                        id="register-email"
                        label="Email"
                        icon="mail"
                        type="email"
                        value={form.email}
                        onChange={form.setEmail}
                        placeholder="voce@email.com"
                        autoComplete="email"
                    />
                    <AuthPasswordField
                        id="register-password"
                        label="Senha"
                        value={form.password}
                        onChange={form.setPassword}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                        minLength={6}
                    />
                    <AuthPasswordField
                        id="register-confirm-password"
                        label="Confirmar senha"
                        value={form.confirmPassword}
                        onChange={form.setConfirmPassword}
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                    />
                    <AuthFormError message={form.error} />
                    <AuthSubmitButton label="Criar conta grátis" busyLabel="Criando…" submitting={form.submitting} />
                    <AuthFormToggle>
                        Já tem conta? <AuthFormLink to="/login">Fazer login</AuthFormLink>
                    </AuthFormToggle>
                </form>
            </AuthCard>
            </AuthCardShell>
        </AuthPageShell>
    );
}
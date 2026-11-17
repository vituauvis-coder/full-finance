type Props = {
    message: string | null;
};

export function AuthFormError({ message }: Props) {
    if (!message) return null;
    return (
        <p id="auth-error" className="error-message" role="alert">
            {message}
        </p>
    );
}